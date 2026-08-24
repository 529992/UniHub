package com.unihub

import android.content.ContentValues
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.io.File
import java.io.FileInputStream

class UniHubFileStoreModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName(): String = "UniHubFileStore"

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