export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          RM Review Systems
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Customer feedback and review-assistance system.
        </p>
        <div className="mt-8 rounded-lg border bg-card p-6 text-left shadow-sm">
          <h2 className="text-xl font-semibold">Foundation</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Application scaffold is running. Domain features (feedback, reviews,
            AI, Google integration) will be implemented in subsequent features.
          </p>
        </div>
      </div>
    </main>
  );
}
