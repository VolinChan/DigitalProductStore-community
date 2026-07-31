export default function Loading() {
  return <main className="store-container animate-pulse"><div className="h-4 w-24 rounded bg-[#e6ebe8]" /><div className="mt-4 h-10 w-full max-w-xl rounded bg-[#e6ebe8]" /><div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index}><div className="aspect-square rounded-[18px] bg-[#e6ebe8]" /><div className="mt-3 h-4 w-4/5 rounded bg-[#e6ebe8]" /><div className="mt-2 h-5 w-1/2 rounded bg-[#e6ebe8]" /></div>)}</div></main>;
}
