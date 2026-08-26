#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FormVideoTrimModule, NSObject)

RCT_EXTERN_METHOD(trim:(NSString *)sourceUri
                  trimStartSeconds:(nonnull NSNumber *)trimStartSeconds
                  trimEndSeconds:(nonnull NSNumber *)trimEndSeconds
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
