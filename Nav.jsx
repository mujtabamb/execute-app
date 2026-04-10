export default function Nav({ active, onChange }) {
  const tabs = [
    { id: 'execution', label: 'Execute', icon: '◉' },
    { id: 'planner',   label: 'Planner', icon: '▦' },
    { id: 'anytime',   label: 'Anytime', icon: '≡' },
  ]

  return (
    <nav className="nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`nav__btn${active === tab.id ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
          aria-label={tab.label}
        >
          <span className="nav__icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
