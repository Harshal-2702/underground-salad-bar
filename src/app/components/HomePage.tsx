import { HeroSection } from './HeroSection';
import { HowItWorksSection } from './HowItWorksSection';
import { PreMadeBowls } from './PreMadeBowls';
import { BuildYourOwnSection } from './BuildYourOwnSection';
import { WhyUSBSection } from './WhyUSBSection';
import { SubscriptionSection } from './SubscriptionSection';
import { SocialProofSection } from './SocialProofSection';
import { OrderingCTASection } from './OrderingCTASection';

interface HomePageProps {
  onBuildBowlClick: () => void;
  onAddToCart: (bowl: any) => void;

  onAddSubscription: (subscription: {
    id: string;
    name: string;
    price: number;
  }) => void;
}

export function HomePage({
  onBuildBowlClick,
  onAddToCart,
  onAddSubscription,
}: HomePageProps) {
  return (
    <div className="min-h-screen">
      <HeroSection onBuildBowlClick={onBuildBowlClick} />

      <HowItWorksSection onBuildBowlClick={onBuildBowlClick} />

      <PreMadeBowls onAddToCart={onAddToCart} />

      <BuildYourOwnSection />

      <WhyUSBSection />

      <SubscriptionSection
        onAddSubscription={onAddSubscription}
      />

      <SocialProofSection />

      <OrderingCTASection
        onBuildBowlClick={onBuildBowlClick}
      />
    </div>
  );
}