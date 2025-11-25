import "./home.css";
import Link from "next/link";
import { Swords, Map, BookOpenCheck, Bell, UserCircle } from "lucide-react";

const metrics = [
  { label: "継続日数", value: "22日" },
  { label: "本日の修練", value: "45分" },
  { label: "棋力レート", value: "1850" },
];

const trainingCards = [
  {
    href: "/play",
    title: "実践対局",
    description: "AIや道場メンバーとの真剣勝負",
    icon: Swords,
    modifier: "training-card--play",
    iconColor: "#1b3b5f",
  },
  {
    href: "/learn",
    title: "特訓",
    description: "弱点テーマを集中的に攻略",
    icon: Map,
    modifier: "training-card--learn",
    iconColor: "#4b7b34",
  },
  {
    href: "/annotate",
    title: "復習",
    description: "棋譜をアップロードしてAIと振り返り",
    icon: BookOpenCheck,
    modifier: "training-card--review",
    iconColor: "#b43a32",
  },
];

export default function HomePage() {
  return (
    <div className="home-root">
      <header className="home-header">
        <div className="home-header-inner">
          <div className="home-logo">
            <span className="home-logo-main">Shogi AI</span>
            <span className="home-logo-sub">Learning</span>
          </div>
          <div className="home-header-icons">
            <button type="button" aria-label="notifications">
              <Bell size={24} />
            </button>
            <button type="button" aria-label="profile">
              <UserCircle size={32} />
            </button>
          </div>
        </div>
      </header>

      <main className="home-main">
        <div className="home-shell">
          <section className="home-metrics">
            {metrics.map((metric, index) => (
              <div
                key={metric.label}
                className={`home-metric-item${index === 1 ? " home-metric-item--divider" : ""}`}
              >
                <p className="home-metric-label">{metric.label}</p>
                <p className="home-metric-value">{metric.value}</p>
              </div>
            ))}
          </section>

          <section className="home-mascot">
            <div className="home-mascot-copy">
              <p className="home-mascot-name">ドラゴ</p>
              <p className="home-mascot-text">
                おかえり！今日は「棒銀」の復習から始めるといい感じだぞ！
              </p>
            </div>
            <div className="home-mascot-avatar" aria-hidden="true">
              🐲
            </div>
          </section>

          <section className="home-training">
            <div className="home-training-header">
              <div className="home-training-accent" />
              <h2 className="home-training-title">修練の間</h2>
            </div>
            <div className="home-training-grid">
              {trainingCards.map((card) => (
                <Link key={card.title} href={card.href} className={`training-card ${card.modifier}`}>
                  <div className="training-card-icon">
                    <card.icon size={24} color={card.iconColor} />
                  </div>
                  <div>
                    <div className="training-card-title">{card.title}</div>
                    <div className="training-card-sub">{card.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
