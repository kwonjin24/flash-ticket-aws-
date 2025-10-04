# Flash Tickets Layout Fix — AI Prompt (Next.js + Tailwind)

Use this prompt **as-is** with your AI code assistant to refactor the login/dashboard layout to a clean, responsive, centered design.

---

## Objective
Refactor the current pages so the layout uses a **two‑column responsive grid** with correct proportions and true center alignment, without relying on arbitrary margins or absolute positioning. It must look balanced at all viewport sizes.

## Global Layout Rules
- Fill the viewport: `width: 100vw; min-height: 100dvh; overflow-x: hidden`.
- Use a **2‑column layout** on `md` and up: **left fixed 420px**, right fluid `1fr` → `grid-template-columns: 420px 1fr`.
- On small screens (`< md`), stack to one column (left section above right section).
- Both columns must stretch to full height and center their content vertically via `flex`.
- No horizontal scrolling at any width.

## Left Column (Brand / Welcome)
- Inner container centered with `mx-auto`, padding `p-8 md:p-10`.
- Limit content width: `max-w-[380px]`.
- Use `flex flex-col gap-6 justify-center` for the text + CTA block.
- Keep a simple gradient background and a footer copyright at the bottom (`mt-auto` allowed).

## Right Column (Main Content / Login)
- The column itself: `flex items-center justify-center p-6 md:p-10` with a subtle light gradient.
- Constrain page max width: wrapper `max-w-7xl mx-auto`.
- Login card width **`w-[420px] max-w-full`**, centered, with `rounded-2xl bg-white shadow-xl p-8 flex flex-col gap-4`.

## Remove Problematic Styles
- Do **not** hard-code wide fixed widths (e.g., `width: 1200px`) that cause empty space.
- Do **not** use `position: absolute` for layout unless absolutely necessary.
- Do **not** center via random `margin-left/right` tricks.
- Always rely on **grid/flex** alignment (`justify-*`, `items-*`, `place-*`).

## Tailwind Refactor Example (JSX/TSX)
```tsx
export default function Page() {
  return (
    <main className="w-screen min-h-dvh overflow-x-hidden grid grid-cols-1 md:[grid-template-columns:420px_1fr]">
      {/* Left */}
      <aside className="bg-gradient-to-b from-slate-900 to-sky-700 text-white p-8 md:p-10 flex">
        <div className="m-auto w-full max-w-[380px] flex flex-col gap-6">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Flash Tickets</h1>
            {/* header actions (history, profile, logout) */}
          </header>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Welcome, 1111!</h2>
            <p className="text-white/80">Choose an event to join the queue.</p>
            <button className="rounded-xl py-4 px-5 bg-white/15 hover:bg-white/25">
              No active events at the moment.
            </button>
          </section>

          <footer className="mt-auto text-xs text-white/60">
            © 2025 Flash Tickets. All rights reserved.
          </footer>
        </div>
      </aside>

      {/* Right */}
      <section className="relative bg-gradient-to-br from-slate-50 to-sky-50 p-6 md:p-10 flex">
        <div className="m-auto w-full max-w-7xl flex items-center justify-center">
          <div className="w-[420px] max-w-full rounded-2xl bg-white shadow-xl p-8 flex flex-col gap-4">
            <h2 className="text-3xl font-bold">Flash Tickets</h2>
            <p className="text-slate-500">
              A fair queue and secure payments ticketing platform.
            </p>
            <input className="input" placeholder="Enter ID" />
            <input className="input" placeholder="Enter password" type="password" />
            <button className="btn-primary">Log In</button>
            <a className="text-sm text-indigo-600">Create an account</a>
          </div>
        </div>
      </section>
    </main>
  );
}
```

> Replace `.input` and `.btn-primary` with your project’s components/utilities.

## Acceptance Criteria
- At **≥1440px**: left column is **exactly 420px**, right column fills the rest; login card is **420px wide** and perfectly centered.
- At **<768px** (`md`): columns stack vertically; login card remains centered with proper padding.
- No large empty space on the right and no overflow on any viewport size.
- Lighthouse layout shift score remains stable (no CLS spikes) when resizing.

## Quick Checklist
- [ ] Parent wrapper: `grid`, `md:[grid-template-columns:420px_1fr]`, `min-h-dvh`.
- [ ] Center children with `flex` + `items-center justify-center`.
- [ ] Remove hard-coded widths/margins and absolute positioning used for layout.
- [ ] Constrain card width to `w-[420px] max-w-full`, container to `max-w-7xl`.
- [ ] Test at 375, 768, 1024, 1280, 1440, and ultra-wide (1920+).
