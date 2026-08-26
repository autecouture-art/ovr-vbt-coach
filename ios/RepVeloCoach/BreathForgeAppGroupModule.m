#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(BreathForgeAppGroupModule, NSObject)

RCT_EXTERN_METHOD(readHistory:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(writeSchedule:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
