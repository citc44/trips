import { WayfinderColors } from '@/constants/design-tokens';
import { OnboardingAcknowledgment } from '@/shared/components/onboarding-acknowledgment';
import { useProfile } from '@/shared/hooks/use-profile';

export default function TrustMomentScreen() {
  const { markTrustMomentSeen } = useProfile();

  return (
    <OnboardingAcknowledgment
      testIdPrefix="trust-moment"
      headline="Your location stays in this Voyage."
      headlineFontSize={30}
      supportingCopy="We never sell your location data. It's visible only to people in your Voyage, and only while it's active."
      iconBackground={WayfinderColors.accentTeal}
      icon="🛡️"
      onAcknowledge={markTrustMomentSeen}
    />
  );
}
