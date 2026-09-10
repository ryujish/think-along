'use client';

import AppLayout from '@/components/layout/AppLayout';

export default function Page() {
  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">

        {/* Greeting */}
        <section className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Good Morning 👋
          </h1>

          <p className="mt-3 text-gray-500">
            What would you like to think about today?
          </p>
        </section>

        {/* Prompt */}
        <section className="rounded-3xl border bg-white p-6 shadow-sm">

          <textarea
            placeholder="Start thinking..."
            className="
              min-h-[260px]
              w-full
              resize-none
              rounded-2xl
              border
              p-5
              text-lg
              outline-none
              focus:border-green-500
            "
          />

          <div className="mt-6 flex flex-wrap justify-center gap-3">

            <button className="rounded-full border px-5 py-2 hover:bg-gray-100">
              GPT
            </button>

            <button className="rounded-full border px-5 py-2 hover:bg-gray-100">
              Claude
            </button>

            <button className="rounded-full border px-5 py-2 hover:bg-gray-100">
              Gemini
            </button>

          </div>

          <div className="mt-8 flex justify-center">

            <button className="w-full rounded-xl bg-green-600 py-4 font-semibold text-white hover:bg-green-700 sm:w-auto sm:px-12">
              Think
            </button>

          </div>

        </section>

        {/* Continue */}
        <section>

          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              Continue
            </h2>

            <button className="text-green-600 hover:underline">
              View all
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">

            <div className="rounded-2xl border p-5 hover:shadow-md">
              <h3 className="font-semibold">
                Product Strategy
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Continue your previous conversation.
              </p>
            </div>

            <div className="rounded-2xl border p-5 hover:shadow-md">
              <h3 className="font-semibold">
                Marketing Ideas
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Resume yesterday&apos;s thinking.
              </p>
            </div>

          </div>

        </section>

      </div>
    </AppLayout>
  );
}
