export default function Home() {
  return (
    <div>
      {/* Navigation */}
<nav className="w-full bg-white flex items-center justify-between px-8 py-4 shadow-sm">
  <img 
    src="/Asset 1.png" 
    alt="Gather" 
    className="w-24"
  />
  <div className="flex items-center gap-3">
    <a href="/" className="bg-gray-900 text-white py-2 px-5 rounded-full font-medium text-sm hover:bg-gray-700 transition-colors">
      Home
    </a>
    <a href="/signup" className="border border-gray-200 text-gray-700 py-2 px-5 rounded-full font-medium text-sm hover:bg-gray-50 transition-colors">
      Get Started
    </a>
  </div>
</nav>
      {/* Hero Section */}
      <main className="relative h-[70vh] w-full overflow-hidden flex flex-col items-center justify-center">
        
        {/* Video Background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/AdobeStock_500438931.mp4" type="video/mp4" />
        </video>

        {/* Sunset Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-orange-400/60 via-pink-500/60 to-violet-700/80" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-6 px-8">
          
          {/* Logo */}
          <img 
            src="/Asset 1.png" 
            alt="Gather" 
            className="w-64 md:w-96"
          />

          {/* Buttons */}
          <div className="flex flex-row gap-3">
            <a href="/signup" className="bg-white text-violet-700 py-4 px-8 rounded-2xl font-semibold text-lg text-center hover:bg-violet-50 transition-colors shadow-lg">
              Create a group
            </a>
            <a href="/login" className="bg-white/20 backdrop-blur-sm text-white py-4 px-8 rounded-2xl font-semibold text-lg text-center border border-white/40 hover:bg-white/30 transition-colors">
              Log in
            </a>
          </div>

          <p className="text-white/80 text-sm">
            Have an invite code?{' '}
            <a href="/join" className="text-white font-semibold hover:underline">
              Join a group
            </a>
          </p>

        </div>
      </main>

      {/* Features Section */}
      <section className="bg-white py-20 px-8">
        <div className="max-w-2xl mx-auto">
          
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            Gather eliminates the chaos of planning with groups.
          </h2>

          <div className="flex flex-col gap-10">
            
            <div className="flex items-start gap-5">
              <img src="/poll.png" alt="" className="w-12 h-12 flex-shrink-0" />
              <div>
                <p className="text-gray-900 text-lg">
                  <span className="font-bold">Poll your friends about activities</span> — no more going back and forth in the group chat because Bob wants to go golfing and Susan wants to have dinner. Vote on plans democratically.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <img src="/clipboard.png" alt="" className="w-12 h-12 flex-shrink-0" />
              <div>
                <p className="text-gray-900 text-lg">
                  <span className="font-bold">Assign tasks to your friends</span> — no more arguing about who was supposed to bring the beer.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <img src="/calendar.png" alt="" className="w-12 h-12 flex-shrink-0" />
              <div>
                <p className="text-gray-900 text-lg">
                  <span className="font-bold">See a group calendar with an agenda of events</span> — no more forgetting your best friend's birthday party.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <img src="/thingstoknow.png" alt="" className="w-12 h-12 flex-shrink-0" />
              <div>
                <p className="text-gray-900 text-lg">
                  <span className="font-bold">Things to know section</span> — give your friends quick info at a glance, i.e. "park on the street" or "bring a swimsuit and a towel!"
                </p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <img src="/infinity.png" alt="" className="w-12 h-12 flex-shrink-0" />
              <div>
                <p className="text-gray-900 text-lg">
                  <span className="font-bold">Set up once, use forever</span> — no more single-use event planning tools that don't save your group info.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <img src="/dashboard.png" alt="" className="w-12 h-12 flex-shrink-0" />
              <div>
                <p className="text-gray-900 text-lg">
                  <span className="font-bold">Group dashboard</span> — see an agenda of upcoming events at a glance.
                </p>
              </div>
            </div>

          </div>

          {/* Bottom CTA */}
          <div className="mt-16 text-center">
            <a href="/signup" className="bg-violet-600 text-white py-4 px-10 rounded-2xl font-semibold text-lg hover:bg-violet-700 transition-colors shadow-lg">
              Get started for free
            </a>
          </div>

        </div>
      </section>
    </div>
  )
}