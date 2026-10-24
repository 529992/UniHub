#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <React/RCTBridgeModule.h>
#import <CommonCrypto/CommonCryptor.h>
#import <CommonCrypto/CommonHMAC.h>
#import <Security/Security.h>

@interface UniHubFileStore : NSObject <RCTBridgeModule>
@end

@implementation UniHubFileStore

RCT_EXPORT_MODULE();

RCT_REMAP_METHOD(saveTextFile,
                 fileName:(NSString *)fileName
                 contents:(NSString *)contents
                 saveResolver:(RCTPromiseResolveBlock)resolve
                 saveRejecter:(RCTPromiseRejectBlock)reject) {
  NSError *error = nil;
  NSString *destinationPath = [self privateFilePath:fileName error:&error];
  if (!destinationPath || ![self writeEncryptedContents:contents toPath:destinationPath error:&error]) {
    reject(@"ENCRYPTED_FILE_SAVE_FAILED", error.localizedDescription ?: @"Could not save encrypted file", error);
    return;
  }
  resolve(destinationPath);
}

RCT_REMAP_METHOD(readTextFile,
                 readFileName:(NSString *)fileName
                 readResolver:(RCTPromiseResolveBlock)resolve
                 readRejecter:(RCTPromiseRejectBlock)reject) {
  NSError *error = nil;
  NSString *sourcePath = [self privateFilePath:fileName error:&error];
  if (!sourcePath) {
    reject(@"ENCRYPTED_FILE_READ_FAILED", error.localizedDescription, error);
    return;
  }
  if (![[NSFileManager defaultManager] fileExistsAtPath:sourcePath]) {
    NSString *documentsPath = NSSearchPathForDirectoriesInDomains(
      NSDocumentDirectory, NSUserDomainMask, YES
    ).firstObject;
    NSString *legacyPath = [documentsPath stringByAppendingPathComponent:fileName];
    if (![[NSFileManager defaultManager] fileExistsAtPath:legacyPath]) {
      resolve([NSNull null]);
      return;
    }
    NSString *legacyContents = [NSString stringWithContentsOfFile:legacyPath
                                                          encoding:NSUTF8StringEncoding
                                                             error:&error];
    if (!legacyContents ||
        ![self writeEncryptedContents:legacyContents toPath:sourcePath error:&error]) {
      reject(@"ENCRYPTED_FILE_MIGRATION_FAILED",
             error.localizedDescription ?: @"Could not migrate LMS URLs", error);
      return;
    }
    if (![[NSFileManager defaultManager] removeItemAtPath:legacyPath error:&error]) {
      reject(@"ENCRYPTED_FILE_MIGRATION_FAILED",
             error.localizedDescription ?: @"Could not remove the old public LMS file", error);
      return;
    }
    resolve(legacyContents);
    return;
  }

  NSString *documentsPath = NSSearchPathForDirectoriesInDomains(
    NSDocumentDirectory, NSUserDomainMask, YES
  ).firstObject;
  NSString *legacyPath = [documentsPath stringByAppendingPathComponent:fileName];
  if ([[NSFileManager defaultManager] fileExistsAtPath:legacyPath] &&
      ![[NSFileManager defaultManager] removeItemAtPath:legacyPath error:&error]) {
    reject(@"ENCRYPTED_FILE_MIGRATION_FAILED",
           error.localizedDescription ?: @"Could not remove the old public LMS file", error);
    return;
  }

  NSData *serializedEnvelope = [NSData dataWithContentsOfFile:sourcePath options:0 error:&error];
  NSDictionary *envelope = serializedEnvelope
    ? [NSJSONSerialization JSONObjectWithData:serializedEnvelope options:0 error:&error]
    : nil;
  NSData *key = [self encryptionKeyWithError:&error];
  NSData *iv = [envelope[@"iv"] isKindOfClass:[NSString class]]
    ? [[NSData alloc] initWithBase64EncodedString:envelope[@"iv"] options:0]
    : nil;
  NSData *ciphertext = [envelope[@"ciphertext"] isKindOfClass:[NSString class]]
    ? [[NSData alloc] initWithBase64EncodedString:envelope[@"ciphertext"] options:0]
    : nil;
  NSData *storedMac = [envelope[@"hmac"] isKindOfClass:[NSString class]]
    ? [[NSData alloc] initWithBase64EncodedString:envelope[@"hmac"] options:0]
    : nil;
  if (![envelope[@"version"] respondsToSelector:@selector(integerValue)] ||
      [envelope[@"version"] integerValue] != 1 || key.length != 64 ||
      iv.length != kCCBlockSizeAES128 || !ciphertext || !storedMac) {
    reject(@"ENCRYPTED_FILE_READ_FAILED", @"Encrypted file is invalid or unsupported", nil);
    return;
  }

  NSMutableData *authenticatedData = [iv mutableCopy];
  [authenticatedData appendData:ciphertext];
  NSData *expectedMac = [self hmacForData:authenticatedData key:[key subdataWithRange:NSMakeRange(32, 32)]];
  if (![self data:storedMac matchesData:expectedMac]) {
    reject(@"ENCRYPTED_FILE_READ_FAILED", @"Encrypted file authentication failed", nil);
    return;
  }
  NSData *plaintext = [self decryptData:ciphertext
                                    key:[key subdataWithRange:NSMakeRange(0, 32)]
                                     iv:iv
                                  error:&error];
  NSString *contents = plaintext
    ? [[NSString alloc] initWithData:plaintext encoding:NSUTF8StringEncoding]
    : nil;
  if (!contents) {
    reject(@"ENCRYPTED_FILE_READ_FAILED", error.localizedDescription ?: @"Could not decrypt file", error);
    return;
  }
  resolve(contents);
}

- (NSString *)privateFilePath:(NSString *)fileName error:(NSError **)error {
  if (![fileName.lastPathComponent isEqualToString:fileName]) {
    if (error) {
      *error = [NSError errorWithDomain:@"UniHubFileStore"
                                   code:1
                               userInfo:@{NSLocalizedDescriptionKey: @"Invalid file name"}];
    }
    return nil;
  }
  NSURL *applicationSupportURL = [[[NSFileManager defaultManager]
    URLsForDirectory:NSApplicationSupportDirectory
           inDomains:NSUserDomainMask] firstObject];
  NSURL *directoryURL = [applicationSupportURL URLByAppendingPathComponent:@"UniHub" isDirectory:YES];
  if (![[NSFileManager defaultManager] createDirectoryAtURL:directoryURL
                                withIntermediateDirectories:YES
                                                 attributes:nil
                                                      error:error]) {
    return nil;
  }
  if (![directoryURL setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:error]) {
    return nil;
  }
  return [[directoryURL URLByAppendingPathComponent:fileName] path];
}

- (BOOL)writeEncryptedContents:(NSString *)contents
                        toPath:(NSString *)path
                         error:(NSError **)error {
  NSData *key = [self encryptionKeyWithError:error];
  if (key.length != 64) {
    if (error && !*error) {
      *error = [NSError errorWithDomain:@"UniHubFileStore"
                                   code:2
                               userInfo:@{NSLocalizedDescriptionKey: @"Invalid encryption key"}];
    }
    return NO;
  }
  NSData *plaintext = [contents dataUsingEncoding:NSUTF8StringEncoding];
  NSData *iv = [self randomDataWithLength:kCCBlockSizeAES128 error:error];
  NSData *ciphertext = key && plaintext && iv
    ? [self encryptData:plaintext key:[key subdataWithRange:NSMakeRange(0, 32)] iv:iv error:error]
    : nil;
  if (!ciphertext) return NO;

  NSMutableData *authenticatedData = [iv mutableCopy];
  [authenticatedData appendData:ciphertext];
  NSData *mac = [self hmacForData:authenticatedData key:[key subdataWithRange:NSMakeRange(32, 32)]];
  NSDictionary *envelope = @{
    @"version": @1,
    @"iv": [iv base64EncodedStringWithOptions:0],
    @"ciphertext": [ciphertext base64EncodedStringWithOptions:0],
    @"hmac": [mac base64EncodedStringWithOptions:0],
  };
  NSData *serializedEnvelope = [NSJSONSerialization dataWithJSONObject:envelope options:0 error:error];
  if (!serializedEnvelope ||
      ![serializedEnvelope writeToFile:path options:NSDataWritingAtomic error:error]) {
    return NO;
  }
  return [[NSFileManager defaultManager] setAttributes:@{
    NSFileProtectionKey: NSFileProtectionComplete,
  } ofItemAtPath:path error:error];
}

- (NSData *)encryptionKeyWithError:(NSError **)error {
  NSString *service = [NSBundle mainBundle].bundleIdentifier ?: @"UniHub";
  NSDictionary *query = @{
    (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrService: service,
    (__bridge id)kSecAttrAccount: @"UnihubFileEncryptionKey",
    (__bridge id)kSecReturnData: @YES,
    (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitOne,
  };
  CFTypeRef result = NULL;
  OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
  if (status == errSecSuccess) {
    return CFBridgingRelease(result);
  }
  if (status != errSecItemNotFound) {
    if (error) *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:status userInfo:nil];
    return nil;
  }

  NSData *key = [self randomDataWithLength:64 error:error];
  if (!key) return nil;
  NSDictionary *attributes = @{
    (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrService: service,
    (__bridge id)kSecAttrAccount: @"UnihubFileEncryptionKey",
    (__bridge id)kSecValueData: key,
    (__bridge id)kSecAttrAccessible: (__bridge id)kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
  };
  status = SecItemAdd((__bridge CFDictionaryRef)attributes, NULL);
  if (status == errSecDuplicateItem) {
    status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
    if (status == errSecSuccess) return CFBridgingRelease(result);
  }
  if (status != errSecSuccess) {
    if (error) *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:status userInfo:nil];
    return nil;
  }
  return key;
}

- (NSData *)randomDataWithLength:(size_t)length error:(NSError **)error {
  NSMutableData *data = [NSMutableData dataWithLength:length];
  OSStatus status = SecRandomCopyBytes(kSecRandomDefault, length, data.mutableBytes);
  if (status != errSecSuccess) {
    if (error) *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:status userInfo:nil];
    return nil;
  }
  return data;
}

- (NSData *)encryptData:(NSData *)data key:(NSData *)key iv:(NSData *)iv error:(NSError **)error {
  size_t outputLength = data.length + kCCBlockSizeAES128;
  NSMutableData *output = [NSMutableData dataWithLength:outputLength];
  size_t bytesWritten = 0;
  CCCryptorStatus status = CCCrypt(kCCEncrypt, kCCAlgorithmAES, kCCOptionPKCS7Padding,
                                   key.bytes, kCCKeySizeAES256, iv.bytes,
                                   data.bytes, data.length, output.mutableBytes,
                                   outputLength, &bytesWritten);
  if (status != kCCSuccess) {
    if (error) *error = [NSError errorWithDomain:@"UniHubFileStore" code:status userInfo:nil];
    return nil;
  }
  output.length = bytesWritten;
  return output;
}

- (NSData *)decryptData:(NSData *)data key:(NSData *)key iv:(NSData *)iv error:(NSError **)error {
  size_t outputLength = data.length + kCCBlockSizeAES128;
  NSMutableData *output = [NSMutableData dataWithLength:outputLength];
  size_t bytesWritten = 0;
  CCCryptorStatus status = CCCrypt(kCCDecrypt, kCCAlgorithmAES, kCCOptionPKCS7Padding,
                                   key.bytes, kCCKeySizeAES256, iv.bytes,
                                   data.bytes, data.length, output.mutableBytes,
                                   outputLength, &bytesWritten);
  if (status != kCCSuccess) {
    if (error) *error = [NSError errorWithDomain:@"UniHubFileStore" code:status userInfo:nil];
    return nil;
  }
  output.length = bytesWritten;
  return output;
}

- (NSData *)hmacForData:(NSData *)data key:(NSData *)key {
  NSMutableData *mac = [NSMutableData dataWithLength:CC_SHA256_DIGEST_LENGTH];
  CCHmac(kCCHmacAlgSHA256, key.bytes, key.length, data.bytes, data.length, mac.mutableBytes);
  return mac;
}

- (BOOL)data:(NSData *)first matchesData:(NSData *)second {
  if (first.length != second.length) return NO;
  const uint8_t *firstBytes = first.bytes;
  const uint8_t *secondBytes = second.bytes;
  uint8_t difference = 0;
  for (NSUInteger index = 0; index < first.length; index++) {
    difference |= firstBytes[index] ^ secondBytes[index];
  }
  return difference == 0;
}

RCT_REMAP_METHOD(saveImagesAsPdf,
                 sourcePaths:(NSArray<NSString *> *)sourcePaths
                 fileName:(NSString *)fileName
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  if (sourcePaths.count == 0) {
    reject(@"PDF_SAVE_FAILED", @"No captured images", nil);
    return;
  }

  NSString *documentsPath = NSSearchPathForDirectoriesInDomains(
    NSDocumentDirectory, NSUserDomainMask, YES
  ).firstObject;
  NSString *destinationPath = [documentsPath stringByAppendingPathComponent:fileName];
  UIImage *firstImage = [UIImage imageWithContentsOfFile:sourcePaths.firstObject];
  if (!firstImage) {
    reject(@"PDF_SAVE_FAILED", @"Could not read captured image", nil);
    return;
  }
  CGRect firstPageRect = CGRectMake(0, 0, firstImage.size.width, firstImage.size.height);
  UIGraphicsBeginPDFContextToFile(destinationPath, firstPageRect, nil);
  for (NSString *sourcePath in sourcePaths) {
    UIImage *image = [UIImage imageWithContentsOfFile:sourcePath];
    if (!image) {
      UIGraphicsEndPDFContext();
      [[NSFileManager defaultManager] removeItemAtPath:destinationPath error:nil];
      reject(@"PDF_SAVE_FAILED", @"Could not read captured image", nil);
      return;
    }
    CGRect pageRect = CGRectMake(0, 0, image.size.width, image.size.height);
    UIGraphicsBeginPDFPageWithInfo(pageRect, nil);
    [image drawInRect:pageRect];
  }
  UIGraphicsEndPDFContext();

  if ([[NSFileManager defaultManager] fileExistsAtPath:destinationPath]) {
    resolve(destinationPath);
  } else {
    reject(@"PDF_SAVE_FAILED", @"Could not save PDF", nil);
  }
}

@end
