import { OnboardingAcknowledgment } from '@/shared/components/onboarding-acknowledgment';
import { useProfile } from '@/shared/hooks/use-profile';

export default function DriverAttentionConsentScreen() {
  const { markDriverConsentSeen } = useProfile();

  return (
    <OnboardingAcknowledgment
      headline="If you're behind the wheel, stay focused on the road — Voylo can't do that for you."
      supportingCopy="Voylo isn't responsible for distracted driving."
      onAcknowledge={markDriverConsentSeen}
    />
  );
}
