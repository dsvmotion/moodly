import { createCipheriv, createDecipheriv, constants, generateKeyPairSync, privateDecrypt, randomBytes, randomUUID, type KeyObject } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  IngressKeyUnavailableError,
  SubmissionRejectedError,
  openSubmission,
  sealSubmission,
  type IngressPublicKey,
} from "@repo/integrations/key-ingress";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { INGRESS_ENCRYPTION_ALGORITHM, createKmsApi, createKmsIngressKeyring, createKmsKeyProvider, type KmsApi } from "./kms.ts";
import { SecretDecryptionError, createSecretVault } from "./vault.ts";

// KMS no se puede probar en real hasta que producto cree las claves (runbook
// kms-staging). Aquí: (1) un KMS falso que se comporta como el de verdad en lo
// que importa (el contexto de cifrado liga la clave simétrica; la asimétrica
// solo descifra con RSAES_OAEP_SHA_256 y la clave que se pide), y (2) el
// cliente real del SDK contra ese KMS falso por HTTP en loopback, para comprobar
// lo que se envía de verdad por el cable.

const VAULT_ARN = "arn:aws:kms:eu-central-1:111122223333:key/11111111-2222-4333-8444-555555555555";
const INGRESS_OLD = "arn:aws:kms:eu-central-1:111122223333:key/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const INGRESS_NEW = "arn:aws:kms:eu-central-1:111122223333:key/ffffffff-0000-4111-8222-333333333333";

function kmsError(name: string): Error {
  return Object.assign(new Error(`${name} (falso)`), { name });
}

/** Un KMS falso con una clave simétrica y claves RSA de ingreso. */
function fakeKms() {
  const symmetric = randomBytes(32);
  const rsa = new Map<string, { privateKey: KeyObject; publicKey: IngressPublicKey }>();
  for (const arn of [INGRESS_OLD, INGRESS_NEW]) {
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    rsa.set(arn, {
      privateKey: pair.privateKey,
      publicKey: { keyRef: arn, spkiDerBase64: pair.publicKey.export({ format: "der", type: "spki" }).toString("base64") },
    });
  }
  const contextAad = (context: Record<string, string> | undefined) => JSON.stringify(Object.entries(context ?? {}).sort());
  const api: KmsApi = {
    encrypt: vi.fn((input: Parameters<KmsApi["encrypt"]>[0]) => {
      if (input.KeyId !== VAULT_ARN) return Promise.reject(kmsError("NotFoundException"));
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", symmetric, iv);
      cipher.setAAD(Buffer.from(contextAad(input.EncryptionContext)));
      const body = Buffer.concat([cipher.update(input.Plaintext ?? new Uint8Array()), cipher.final()]);
      return Promise.resolve({ CiphertextBlob: Buffer.concat([iv, cipher.getAuthTag(), body]), KeyId: VAULT_ARN });
    }),
    decrypt: vi.fn((input: Parameters<KmsApi["decrypt"]>[0]) => {
      const blob = Buffer.from(input.CiphertextBlob ?? new Uint8Array());
      if (input.KeyId === VAULT_ARN) {
        try {
          const decipher = createDecipheriv("aes-256-gcm", symmetric, blob.subarray(0, 12));
          decipher.setAAD(Buffer.from(contextAad(input.EncryptionContext)));
          decipher.setAuthTag(blob.subarray(12, 28));
          return Promise.resolve({ Plaintext: Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]), KeyId: VAULT_ARN });
        } catch {
          return Promise.reject(kmsError("InvalidCiphertextException"));
        }
      }
      const key = rsa.get(input.KeyId ?? "");
      if (!key) return Promise.reject(kmsError("NotFoundException"));
      if (input.EncryptionAlgorithm !== "RSAES_OAEP_SHA_256") return Promise.reject(kmsError("InvalidCiphertextException"));
      try {
        const plaintext = privateDecrypt({ key: key.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, blob);
        return Promise.resolve({ Plaintext: plaintext, KeyId: input.KeyId });
      } catch {
        return Promise.reject(kmsError("InvalidCiphertextException"));
      }
    }),
  };
  return { api, publicKey: (arn: string) => rsa.get(arn)?.publicKey as IngressPublicKey };
}

const KEY = ["kbx", "kms", "test", "0001"].join("_");
const ctx = () => ({ organizationId: randomUUID(), integrationId: randomUUID(), submissionId: randomUUID(), provider: "koibox" });

describe("SecretVault con KMS", () => {
  it("sella y abre con la clave de SecretVault y el contexto {organization_id}", async () => {
    const { api } = fakeKms();
    const vault = createSecretVault(createKmsKeyProvider(api, VAULT_ARN));
    const org = randomUUID();
    const sealed = await vault.seal(org, KEY);
    expect(sealed.keyRef).toBe(VAULT_ARN);
    expect(JSON.stringify(sealed)).not.toContain(KEY);
    await expect(vault.open(org, sealed)).resolves.toBe(KEY);
    expect(api.encrypt).toHaveBeenCalledWith(expect.objectContaining({ KeyId: VAULT_ARN, EncryptionContext: { organization_id: org } }));
    expect(api.decrypt).toHaveBeenCalledWith(expect.objectContaining({ KeyId: VAULT_ARN, EncryptionContext: { organization_id: org } }));
  });

  it("un secreto copiado a otra organización no se abre (el contexto no casa)", async () => {
    const { api } = fakeKms();
    const vault = createSecretVault(createKmsKeyProvider(api, VAULT_ARN));
    const sealed = await vault.seal(randomUUID(), KEY);
    await expect(vault.open(randomUUID(), sealed)).rejects.toBeInstanceOf(SecretDecryptionError);
  });

  it("un secreto con otro key_ref (p. ej. local:v1) ni se intenta abrir con KMS", async () => {
    const { api } = fakeKms();
    const vault = createSecretVault(createKmsKeyProvider(api, VAULT_ARN));
    await expect(vault.open(randomUUID(), { keyRef: "local:v1", encryptedDataKey: "QUFB", ciphertext: "QUFB" })).rejects.toBeInstanceOf(
      SecretDecryptionError,
    );
    expect(api.decrypt).not.toHaveBeenCalled();
  });

  it("un fallo pasajero de KMS (límite, red) se lanza tal cual, para reintentarlo; no es «no se descifra»", async () => {
    const { api } = fakeKms();
    const vault = createSecretVault(createKmsKeyProvider(api, VAULT_ARN));
    const org = randomUUID();
    const sealed = await vault.seal(org, KEY);
    vi.mocked(api.decrypt).mockRejectedValueOnce(kmsError("ThrottlingException"));
    const err = await vault.open(org, sealed).then(
      () => new Error("no falló"),
      (e: unknown) => e as Error,
    );
    expect(err.name).toBe("ThrottlingException");
    expect(err).not.toBeInstanceOf(SecretDecryptionError);
  });

  it("si KMS dice que descifró con otra clave, o la clave de datos no mide 32 bytes, no se usa", async () => {
    const { api } = fakeKms();
    const vault = createSecretVault(createKmsKeyProvider(api, VAULT_ARN));
    const org = randomUUID();
    const sealed = await vault.seal(org, KEY);
    vi.mocked(api.decrypt).mockResolvedValueOnce({ Plaintext: randomBytes(32), KeyId: INGRESS_OLD });
    await expect(vault.open(org, sealed)).rejects.toBeInstanceOf(SecretDecryptionError);
    vi.mocked(api.decrypt).mockResolvedValueOnce({ Plaintext: randomBytes(16), KeyId: VAULT_ARN });
    await expect(vault.open(org, sealed)).rejects.toBeInstanceOf(SecretDecryptionError);
  });
});

describe("Claves de ingreso con KMS", () => {
  it("abre lo que cifra la web con la parte pública, con RSAES_OAEP_SHA_256 y la clave del envío", async () => {
    const { api, publicKey } = fakeKms();
    const keyring = createKmsIngressKeyring(api, [INGRESS_OLD]);
    const c = ctx();
    const sealed = sealSubmission(publicKey(INGRESS_OLD), c, KEY);
    await expect(openSubmission(keyring, c, sealed)).resolves.toBe(KEY);
    expect(api.decrypt).toHaveBeenCalledWith(expect.objectContaining({ KeyId: INGRESS_OLD, EncryptionAlgorithm: INGRESS_ENCRYPTION_ALGORITHM }));
  });

  it("durante una rotación abre los envíos de la clave vieja y los de la nueva (nota de V10)", async () => {
    const { api, publicKey } = fakeKms();
    const keyring = createKmsIngressKeyring(api, [INGRESS_OLD, INGRESS_NEW]);
    const a = ctx();
    const b = ctx();
    await expect(openSubmission(keyring, a, sealSubmission(publicKey(INGRESS_OLD), a, KEY))).resolves.toBe(KEY);
    await expect(openSubmission(keyring, b, sealSubmission(publicKey(INGRESS_NEW), b, KEY))).resolves.toBe(KEY);
  });

  it("un key_ref que no está en la lista se rechaza sin llamar a KMS", async () => {
    const { api, publicKey } = fakeKms();
    const keyring = createKmsIngressKeyring(api, [INGRESS_NEW]);
    const c = ctx();
    await expect(openSubmission(keyring, c, sealSubmission(publicKey(INGRESS_OLD), c, KEY))).rejects.toBeInstanceOf(SubmissionRejectedError);
    expect(api.decrypt).not.toHaveBeenCalled();
  });

  it("un envío movido a otra organización no se abre (el dato asociado del sobre)", async () => {
    const { api, publicKey } = fakeKms();
    const keyring = createKmsIngressKeyring(api, [INGRESS_OLD]);
    const c = ctx();
    const sealed = sealSubmission(publicKey(INGRESS_OLD), c, KEY);
    await expect(openSubmission(keyring, { ...c, organizationId: randomUUID() }, sealed)).rejects.toBeInstanceOf(SubmissionRejectedError);
  });

  it("un texto cifrado que no es de esa clave es un envío que no se abre; un fallo pasajero de KMS se reintenta", async () => {
    const { api, publicKey } = fakeKms();
    const keyring = createKmsIngressKeyring(api, [INGRESS_OLD, INGRESS_NEW]);
    const c = ctx();
    // Cifrado con la nueva pero diciendo que es de la vieja: KMS no lo descifra.
    const sealed = { ...sealSubmission(publicKey(INGRESS_NEW), c, KEY), keyRef: INGRESS_OLD };
    await expect(openSubmission(keyring, c, sealed)).rejects.toBeInstanceOf(SubmissionRejectedError);
    vi.mocked(api.decrypt).mockRejectedValueOnce(kmsError("KMSInternalException"));
    const good = sealSubmission(publicKey(INGRESS_OLD), c, KEY);
    const err = await openSubmission(keyring, c, good).then(
      () => new Error("no falló"),
      (e: unknown) => e as Error,
    );
    expect(err).toBeInstanceOf(IngressKeyUnavailableError);
    expect(err.message).not.toContain(KEY);
  });

  it("si KMS responde con otra clave, no se usa", async () => {
    const { api, publicKey } = fakeKms();
    const keyring = createKmsIngressKeyring(api, [INGRESS_OLD]);
    const c = ctx();
    vi.mocked(api.decrypt).mockResolvedValueOnce({ Plaintext: randomBytes(32), KeyId: INGRESS_NEW });
    await expect(openSubmission(keyring, c, sealSubmission(publicKey(INGRESS_OLD), c, KEY))).rejects.toBeInstanceOf(SubmissionRejectedError);
  });
});

describe("el cliente real del SDK, contra un KMS falso en loopback", () => {
  // El protocolo de KMS es JSON 1.1: POST / con X-Amz-Target «TrentService.<Operación>»
  // y los binarios en base64. El falso responde como el de verdad lo que el
  // worker usa, y guarda lo que recibe.
  const received: { target: string | undefined; body: Record<string, unknown> }[] = [];
  const { api: fake, publicKey: wirePublicKey } = fakeKms();
  let server: Server;
  let endpoint = "";

  const readBody = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let data = "";
      req.on("data", (chunk: Buffer) => (data += chunk.toString("utf8")));
      req.on("end", () => resolve(data));
    });

  beforeAll(async () => {
    server = createServer((req, res) => {
      void readBody(req).then(async (raw) => {
        const body = JSON.parse(raw) as Record<string, unknown>;
        const target = req.headers["x-amz-target"] as string | undefined;
        received.push({ target, body });
        const blob = (field: string) => (typeof body[field] === "string" ? Buffer.from(body[field], "base64") : undefined);
        try {
          const out =
            target === "TrentService.Encrypt"
              ? await fake.encrypt({
                  KeyId: body["KeyId"] as string,
                  Plaintext: blob("Plaintext"),
                  EncryptionContext: body["EncryptionContext"] as Record<string, string>,
                })
              : await fake.decrypt({
                  KeyId: body["KeyId"] as string,
                  CiphertextBlob: blob("CiphertextBlob"),
                  EncryptionContext: body["EncryptionContext"] as Record<string, string> | undefined,
                  EncryptionAlgorithm: body["EncryptionAlgorithm"] as "RSAES_OAEP_SHA_256" | undefined,
                });
          const json: Record<string, string> = { KeyId: out.KeyId ?? "" };
          if ("CiphertextBlob" in out && out.CiphertextBlob) json["CiphertextBlob"] = Buffer.from(out.CiphertextBlob).toString("base64");
          if ("Plaintext" in out && out.Plaintext) json["Plaintext"] = Buffer.from(out.Plaintext).toString("base64");
          res.writeHead(200, { "content-type": "application/x-amz-json-1.1" }).end(JSON.stringify(json));
        } catch (err) {
          const name = err instanceof Error ? err.name : "KMSInternalException";
          res.writeHead(400, { "content-type": "application/x-amz-json-1.1" }).end(JSON.stringify({ __type: name, message: "falso" }));
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  // Credenciales de mentira solo para firmar contra el KMS falso local.
  const credentials = { accessKeyId: ["AKIA", "TESTONLY"].join(""), secretAccessKey: ["test", "only"].join("-") };

  it("Encrypt y Decrypt de SecretVault van con su ARN, el contexto {organization_id} y los binarios en base64", async () => {
    const api = createKmsApi("eu-central-1", { endpoint, credentials });
    const vault = createSecretVault(createKmsKeyProvider(api, VAULT_ARN));
    const org = randomUUID();
    const sealed = await vault.seal(org, KEY);
    await expect(vault.open(org, sealed)).resolves.toBe(KEY);
    const [enc, dec] = received.slice(-2);
    expect(enc).toMatchObject({ target: "TrentService.Encrypt", body: { KeyId: VAULT_ARN, EncryptionContext: { organization_id: org } } });
    expect(Buffer.from(String(enc?.body["Plaintext"]), "base64")).toHaveLength(32);
    expect(dec).toMatchObject({ target: "TrentService.Decrypt", body: { KeyId: VAULT_ARN, EncryptionContext: { organization_id: org } } });
    // Otra organización: el KMS falso responde InvalidCiphertextException y el SDK lo trae con ese nombre.
    await expect(vault.open(randomUUID(), sealed)).rejects.toBeInstanceOf(SecretDecryptionError);
  });

  it("Decrypt de ingreso va con el ARN del envío y RSAES_OAEP_SHA_256, y abre lo que cifró la web", async () => {
    const api = createKmsApi("eu-central-1", { endpoint, credentials });
    const keyring = createKmsIngressKeyring(api, [INGRESS_OLD]);
    const c = ctx();
    await expect(openSubmission(keyring, c, sealSubmission(wirePublicKey(INGRESS_OLD), c, KEY))).resolves.toBe(KEY);
    expect(received.at(-1)).toMatchObject({
      target: "TrentService.Decrypt",
      body: { KeyId: INGRESS_OLD, EncryptionAlgorithm: "RSAES_OAEP_SHA_256" },
    });
    // Un texto cifrado que no es de esa clave: InvalidCiphertextException por el cable → el envío no se abre.
    const junk = { keyRef: INGRESS_OLD, encryptedDataKey: randomBytes(256).toString("base64"), ciphertext: randomBytes(64).toString("base64") };
    await expect(openSubmission(keyring, c, junk)).rejects.toBeInstanceOf(SubmissionRejectedError);
  });
});
