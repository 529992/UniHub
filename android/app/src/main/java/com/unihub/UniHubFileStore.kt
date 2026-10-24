package com.unihub

import android.content.ContentValues
import android.content.ContentUris
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.io.File
import java.io.FileInputStream
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.util.Base64
import org.json.JSONObject

class UniHubFileStoreModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName(): String = "UniHubFileStore"

  @ReactMethod
  fun saveTextFile(fileName: String, contents: String, promise: Promise) {
    try {
      val destination = privateFile(fileName)
      writeEncryptedFile(destination, contents)
      promise.resolve(destination.absolutePath)
    } catch (error: Exception) {
      promise.reject("ENCRYPTED_FILE_SAVE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun readTextFile(fileName: String, promise: Promise) {
    try {
      val source = privateFile(fileName)
      if (!source.exists()) {
        promise.resolve(migrateLegacyTextFile(fileName))
        return
      }
      removeLegacyPublicFile(fileName)
      val envelope = JSONObject(source.readText(Charsets.UTF_8))
      if (envelope.getInt("version") != 1) {
        error("Unsupported encrypted file version")
      }
      val iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)
      val encryptedContents = Base64.decode(envelope.getString("ciphertext"), Base64.NO_WRAP)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), GCMParameterSpec(128, iv))
      promise.resolve(String(cipher.doFinal(encryptedContents), Charsets.UTF_8))
    } catch (error: Exception) {
      promise.reject("ENCRYPTED_FILE_READ_FAILED", error.message, error)
    }
  }

  private fun privateFile(fileName: String): File {
    require(fileName == File(fileName).name) { "Invalid file name" }
    return File(reactApplicationContext.filesDir, fileName)
  }

  private fun writeEncryptedFile(destination: File, contents: String) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, encryptionKey())
    val encryptedContents = cipher.doFinal(contents.toByteArray(Charsets.UTF_8))
    val envelope = JSONObject()
      .put("version", 1)
      .put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
      .put("ciphertext", Base64.encodeToString(encryptedContents, Base64.NO_WRAP))
    val atomicFile = android.util.AtomicFile(destination)
    val output = atomicFile.startWrite()
    try {
      output.write(envelope.toString().toByteArray(Charsets.UTF_8))
      atomicFile.finishWrite(output)
    } catch (error: Exception) {
      atomicFile.failWrite(output)
      throw error
    }
  }

  private fun migrateLegacyTextFile(fileName: String): String? {
    val oldDownloadsFile = File(
      Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
      fileName,
    )
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      if (!oldDownloadsFile.exists()) return null
      val contents = oldDownloadsFile.readText(Charsets.UTF_8)
      writeEncryptedFile(privateFile(fileName), contents)
      removeLegacyPublicFile(fileName)
      return contents
    }

    val legacyUri = findLegacyDownloadUri(fileName) ?: return null
    val resolver = reactApplicationContext.contentResolver
    val contents = resolver.openInputStream(legacyUri)?.bufferedReader(Charsets.UTF_8)?.use {
      it.readText()
    } ?: error("Could not read the old public LMS file")
    writeEncryptedFile(privateFile(fileName), contents)
    removeLegacyPublicFile(fileName)
    return contents
  }

  private fun removeLegacyPublicFile(fileName: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      val oldFile = File(
        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
        fileName,
      )
      if (oldFile.exists() && !oldFile.delete()) {
        error("Could not remove the old public LMS file")
      }
      return
    }

    val legacyUri = findLegacyDownloadUri(fileName) ?: return
    if (reactApplicationContext.contentResolver.delete(legacyUri, null, null) == 0) {
      error("Could not remove the old public LMS file")
    }
  }

  private fun findLegacyDownloadUri(fileName: String): Uri? {
    val downloadsUri = MediaStore.Downloads.EXTERNAL_CONTENT_URI
    return reactApplicationContext.contentResolver.query(
      downloadsUri,
      arrayOf(MediaStore.Downloads._ID),
      "${MediaStore.MediaColumns.DISPLAY_NAME} = ? AND ${MediaStore.MediaColumns.RELATIVE_PATH} = ?",
      arrayOf(fileName, "${Environment.DIRECTORY_DOWNLOADS}/"),
      null,
    )?.use { cursor ->
      if (cursor.moveToFirst()) {
        ContentUris.withAppendedId(downloadsUri, cursor.getLong(0))
      } else {
        null
      }
    }
  }

  private fun encryptionKey(): SecretKey {
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val alias = "UniHub.LmsUrls"
    val existingKey = keyStore.getKey(alias, null) as? SecretKey
    if (existingKey != null) return existingKey

    val keyGenerator = KeyGenerator.getInstance(
      KeyProperties.KEY_ALGORITHM_AES,
      "AndroidKeyStore",
    )
    keyGenerator.init(
      KeyGenParameterSpec.Builder(
        alias,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
        .build(),
    )
    return keyGenerator.generateKey()
  }

  @ReactMethod
  fun saveToDownloads(sourcePath: String, fileName: String, promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val values = ContentValues().apply {
          put(MediaStore.Downloads.DISPLAY_NAME, fileName)
          put(MediaStore.Downloads.MIME_TYPE, "image/jpeg")
          put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
          put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val resolver = reactApplicationContext.contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
          ?: error("Could not create Downloads file")
        try {
          resolver.openOutputStream(uri)?.use { output ->
            FileInputStream(sourcePath).use { input -> input.copyTo(output) }
          } ?: error("Could not open Downloads file")
          values.clear()
          values.put(MediaStore.Downloads.IS_PENDING, 0)
          resolver.update(uri, values, null, null)
          promise.resolve(uri.toString())
        } catch (error: Exception) {
          resolver.delete(uri, null, null)
          throw error
        }
      } else {
        val downloads = Environment.getExternalStoragePublicDirectory(
          Environment.DIRECTORY_DOWNLOADS,
        )
        downloads.mkdirs()
        val destination = File(downloads, fileName)
        FileInputStream(sourcePath).use { input ->
          destination.outputStream().use { output -> input.copyTo(output) }
        }
        promise.resolve(destination.absolutePath)
      }
    } catch (error: Exception) {
      promise.reject("DOWNLOAD_SAVE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun saveImagesAsPdf(sourcePaths: ReadableArray, fileName: String, promise: Promise) {
    val document = PdfDocument()
    try {
      if (sourcePaths.size() == 0) error("No captured images")
      for (index in 0 until sourcePaths.size()) {
        val bitmap = BitmapFactory.decodeFile(sourcePaths.getString(index))
          ?: error("Could not read captured image")
        val pageInfo = PdfDocument.PageInfo.Builder(bitmap.width, bitmap.height, index + 1).create()
        val page = document.startPage(pageInfo)
        page.canvas.drawColor(Color.WHITE)
        page.canvas.drawBitmap(bitmap, 0f, 0f, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        document.finishPage(page)
        bitmap.recycle()
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val values = ContentValues().apply {
          put(MediaStore.Downloads.DISPLAY_NAME, fileName)
          put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
          put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
          put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val resolver = reactApplicationContext.contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
          ?: error("Could not create Downloads file")
        try {
          resolver.openOutputStream(uri)?.use { output -> document.writeTo(output) }
            ?: error("Could not open Downloads file")
          values.clear()
          values.put(MediaStore.Downloads.IS_PENDING, 0)
          resolver.update(uri, values, null, null)
          promise.resolve(uri.toString())
        } catch (error: Exception) {
          resolver.delete(uri, null, null)
          throw error
        }
      } else {
        val downloads = Environment.getExternalStoragePublicDirectory(
          Environment.DIRECTORY_DOWNLOADS,
        )
        downloads.mkdirs()
        val destination = File(downloads, fileName)
        destination.outputStream().use { output -> document.writeTo(output) }
        promise.resolve(destination.absolutePath)
      }
    } catch (error: Exception) {
      promise.reject("PDF_SAVE_FAILED", error.message, error)
    } finally {
      document.close()
    }
  }
}

class UniHubPackage : com.facebook.react.ReactPackage {
  override fun createNativeModules(
      reactContext: ReactApplicationContext,
  ): List<com.facebook.react.bridge.NativeModule> = listOf(UniHubFileStoreModule(reactContext))

  override fun createViewManagers(
      reactContext: ReactApplicationContext,
  ): List<com.facebook.react.uimanager.ViewManager<*, *>> = emptyList()
}