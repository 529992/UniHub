#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <React/RCTBridgeModule.h>

@interface UniHubFileStore : NSObject <RCTBridgeModule>
@end

@implementation UniHubFileStore

RCT_EXPORT_MODULE();

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
