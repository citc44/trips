import { OnboardingAcknowledgment } from '@/shared/components/onboarding-acknowledgment';
import { useProfile } from '@/shared/hooks/use-profile';

export default function TrustMomentScreen() {
  const { markTrustMomentSeen } = useProfile();

  return (
    <OnboardingAcknowledgment
      testIdPrefix="trust-moment"
      headline="Your location stays in this Voyage."
      supportingCopy="We never sell your location data. It's visible only to people in your Voyage, and only while it's active."
      onAcknowledge={markTrustMomentSeen}
    />
  );
}
