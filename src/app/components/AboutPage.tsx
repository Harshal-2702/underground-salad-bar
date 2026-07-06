
export function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Minimal Typography */}
      <section className="relative py-24 sm:py-32 lg:py-40 bg-[#FAF5E4]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-['Anton'] font-bold text-[#1A1209] text-5xl sm:text-6xl lg:text-7xl mb-8 leading-tight">
            Our Story
          </h1>
          <p className="text-[#1A1209]/70 text-xl sm:text-2xl max-w-3xl mx-auto leading-relaxed">
            Bringing healthy, customizable meals to Pune
          </p>
        </div>
      </section>

      {/* Story Section - Typography Focused */}
      <section className="py-20 sm:py-28 lg:py-36">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <p className="text-[#1A1209] text-2xl sm:text-3xl leading-relaxed font-['Anton']">
            Underground Salad Bar was born from a simple observation: Pune needed a fast, fresh, and flavorful option that didn't compromise on nutrition or taste.
          </p>

          <p className="text-[#1A1209]/80 text-lg sm:text-xl leading-relaxed">
            Inspired by the build-your-own bowl concept popularized by brands like Chipotle, we adapted this model to celebrate the rich diversity of Indian cuisine. Every ingredient is thoughtfully sourced, every recipe carefully crafted, and every bowl made fresh to order.
          </p>

          <div className="border-l-4 border-[#1F3D2B] pl-6 sm:pl-8 py-4">
            <p className="text-[#1A1209]/80 text-lg sm:text-xl leading-relaxed italic">
              Whether you're looking for a protein-packed meal, something nutritious for lunch, or simply value your health, Underground Salad Bar gives you complete control over what goes into your bowl.
            </p>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-20 sm:py-28 bg-[#FAF5E4]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <h2 className="font-['Anton'] font-bold text-[#1A1209] text-4xl sm:text-5xl text-center">
            Our Philosophy
          </h2>

          <p className="text-[#1A1209] text-2xl sm:text-3xl leading-relaxed font-['Anton'] text-center">
            Healthy eating shouldn't be boring, restrictive, or one-size-fits-all.
          </p>

          <p className="text-[#1A1209]/80 text-lg sm:text-xl leading-relaxed text-center">
            That's why we put you in control. Build a bowl that matches your dietary goals, your taste preferences, and your lifestyle.
          </p>
        </div>
      </section>

      {/* Values - Simple Grid */}
      <section className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <h3 className="font-['Anton'] font-semibold text-[#1A1209] text-2xl mb-4">
                Fresh
              </h3>
              <p className="text-[#1A1209]/70 leading-relaxed">
                Every ingredient is selected for quality and freshness
              </p>
            </div>
            <div className="text-center">
              <h3 className="font-['Anton'] font-semibold text-[#1A1209] text-2xl mb-4">
                Customizable
              </h3>
              <p className="text-[#1A1209]/70 leading-relaxed">
                Build your bowl exactly the way you want it
              </p>
            </div>
            <div className="text-center">
              <h3 className="font-['Anton'] font-semibold text-[#1A1209] text-2xl mb-4">
                Delicious
              </h3>
              <p className="text-[#1A1209]/70 leading-relaxed">
                Healthy food that actually tastes amazing
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}