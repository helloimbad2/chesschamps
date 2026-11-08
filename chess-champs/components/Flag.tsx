export default function Flag({ code }: { code?: string | null }) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null
  const c = code.toLowerCase()
  let name = code.toUpperCase()
  try { name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? name } catch {}
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="flag"
      src={`https://flagcdn.com/w40/${c}.png`}
      srcSet={`https://flagcdn.com/w80/${c}.png 2x`}
      width={20}
      height={15}
      alt={name}
      title={name}
      loading="lazy"
    />
  )
}
