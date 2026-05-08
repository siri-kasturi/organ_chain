package com.odat.services

import net.corda.core.node.AppServiceHub
import net.corda.core.node.services.CordaService
import net.corda.core.serialization.SingletonSerializeAsToken
import java.util.concurrent.ConcurrentHashMap
import javax.crypto.SecretKey

@CordaService
class KeyVaultService(private val serviceHub: AppServiceHub) : SingletonSerializeAsToken() {

    private val keyStore: MutableMap<String, SecretKey> = ConcurrentHashMap()

    companion object {
        private const val DONOR_PII_KEY_ALIAS     = "odat_donor_pii_key"
        private const val RECIPIENT_PII_KEY_ALIAS = "odat_recipient_pii_key"
        const val         MEDICAL_KEY_ALIAS        = "odat_medical_field_key"

        // DEV FALLBACK KEYS — used only when the alias is absent from node.conf.
        // All three are FIXED constants so every node derives the SAME key,
        // which is what prevents AEADBadTagException during development.
        // DO NOT use these in production — generate real keys with:
        //   openssl rand -base64 32 qS43Pr6L6Uj8W6Z7mN2V9xRzB4Y1aD3cE5gH7iJ9kL0=
        private const val DEV_DONOR_PII_KEY     = "qS43Pr6L6Uj8W6Z7mN2V9xRzB4Y1aD3cE5gH7iJ9kL0="
        private const val DEV_RECIPIENT_PII_KEY = "mN2V9xRzB4Y1aD3cE5gH7iJ9kL0qS43Pr6L6Uj8W6Z7="
        private const val DEV_MEDICAL_KEY       = "E5gH7iJ9kL0qS43Pr6L6Uj8W6Z7mN2V9xRzB4Y1aD3c="
    }

    fun getDonorKey(): SecretKey =
        keyStore.getOrPut(DONOR_PII_KEY_ALIAS) { loadKey(DONOR_PII_KEY_ALIAS, DEV_DONOR_PII_KEY) }

    fun getRecipientKey(): SecretKey =
        keyStore.getOrPut(RECIPIENT_PII_KEY_ALIAS) { loadKey(RECIPIENT_PII_KEY_ALIAS, DEV_RECIPIENT_PII_KEY) }

    fun getMedicalKey(): SecretKey =
        keyStore.getOrPut(MEDICAL_KEY_ALIAS) { loadKey(MEDICAL_KEY_ALIAS, DEV_MEDICAL_KEY) }

    private fun loadKey(alias: String, devFallback: String): SecretKey {
        return try {
            val base64Key = serviceHub.getAppContext().config.getString(alias)
            AESUtils.keyFromBase64(base64Key)
        } catch (e: Exception) {
            // Config entry absent — fall back to shared dev constant.
            // This key is identical on all nodes, so encrypt/decrypt always agree.
            AESUtils.keyFromBase64(devFallback)
        }
    }
}