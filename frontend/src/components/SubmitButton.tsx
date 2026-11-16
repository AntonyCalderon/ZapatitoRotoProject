type Props = { pending: boolean; idle: string; busy: string }

export default function SubmitButton({ pending, idle, busy }: Props) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-3 rounded-xl bg-cat px-4 py-3.5 font-bold text-black shadow-md shadow-amber-300/50 transition hover:bg-cat-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? busy : idle}
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-cat">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  )
}