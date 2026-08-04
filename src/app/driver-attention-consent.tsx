import { WayfinderColors } from '@/constants/design-tokens';
import { OnboardingAcknowledgment } from '@/shared/components/onboarding-acknowledgment';
import { useProfile } from '@/shared/hooks/use-profile';

export default function DriverAttentionConsentScreen() {
  const { markDriverConsentSeen } = useProfile();

  return (
    <OnboardingAcknowledgment
      testIdPrefix="driver-consent"
      headline="If you're behind the wheel, stay focused on the road — Voylo can't do that for you."
      headlineFontSize={28}
      supportingCopy="Voylo isn't responsible for distracted driving."
      iconBackground={WayfinderColors.accentAmber}
      icon="🚘"
      onAcknowledge={markDriverConsentSeen}
    />
  );
}
