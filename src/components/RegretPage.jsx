import React, { useState, useEffect, useCallback } from "react";
import {
  hasApiKey,
  getApiKey,
  setApiKey,
  categorizeReason,
  clearCache,
} from "../services/aiCategorizer";

const RegretPage = ({ trades, onBack }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [aiCategories, setAiCategories] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [error, setError] = useState("");

  // Check if AI is configured
  const aiEnabled = hasApiKey();

  // Collect all losses from trades
  const allLosses = React.useMemo(() => {
    const losses = [];
    Object.values(trades).forEach((weekTrades) => {
      Object.values(weekTrades).forEach((dayTrades) => {
        dayTrades.forEach((trade) => {
          if (trade.type === "loss" && trade.reason) {
            losses.push({
              reason: trade.reason.trim(),
              amount: parseFloat(trade.amount || 0),
            });
          }
        });
      });
    });
    return losses;
  }, [trades]);

  // Calculate totals
  const totalLossValue = allLosses.reduce((sum, l) => sum + l.amount, 0);
  const totalLossCount = allLosses.length;

  // AI categorization function
  const runAiCategorization = useCallback(async () => {
    if (!aiEnabled || allLosses.length === 0) return;

    setIsLoading(true);
    setError("");
    const categories = {};

    try {
      for (let i = 0; i < allLosses.length; i++) {
        const loss = allLosses[i];
        setLoadingProgress(`Menganalisis ${i + 1}/${allLosses.length}...`);

        const category = await categorizeReason(loss.reason);

        if (!categories[category]) {
          categories[category] = {
            category,
            examples: [],
            count: 0,
            totalAmount: 0,
          };
        }

        categories[category].count += 1;
        categories[category].totalAmount += loss.amount;
        if (
          categories[category].examples.length < 3 &&
          !categories[category].examples.includes(loss.reason)
        ) {
          categories[category].examples.push(loss.reason);
        }
      }

      setAiCategories(categories);
    } catch (err) {
      setError(err.message || "Gagal menganalisis dengan AI");
    } finally {
      setIsLoading(false);
      setLoadingProgress("");
    }
  }, [aiEnabled, allLosses]);

  // Run AI categorization when enabled and losses exist
  useEffect(() => {
    if (
      aiEnabled &&
      allLosses.length > 0 &&
      Object.keys(aiCategories).length === 0
    ) {
      runAiCategorization();
    }
  }, [aiEnabled, allLosses, aiCategories, runAiCategorization]);

  // Convert categories to sorted array
  const topMistakes = Object.values(aiCategories).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.totalAmount - a.totalAmount;
  });

  // Save API key
  const saveApiKey = () => {
    if (apiKeyInput.trim().length < 10) {
      setError("API key terlalu pendek");
      return;
    }
    setApiKey(apiKeyInput.trim());
    setShowSettings(false);
    setApiKeyInput("");
    setAiCategories({});
    clearCache();
    // Will trigger re-categorization via useEffect
  };

  // Refresh categorization
  const handleRefresh = () => {
    clearCache();
    setAiCategories({});
    runAiCategorization();
  };

  return (
    <div className="container fade-in">
      <div className="header">
        <button onClick={onBack} className="back-btn">
          ← Kembali ke Jurnal
        </button>
        <h1>🤡 Tembok Penyesalan</h1>
        <p>Belajarlah dari kebodohanmu sendiri agar tidak miskin permanen.</p>
      </div>

      {/* AI Status Bar */}
      <div className="ai-status-bar">
        <div className="ai-status-left">
          {aiEnabled ? (
            <>
              <span className="ai-badge enabled">🤖 AI Aktif</span>
              <button
                className="refresh-btn"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                🔄 Refresh
              </button>
            </>
          ) : (
            <span className="ai-badge disabled">⚠️ AI Belum Aktif</span>
          )}
        </div>
        <button className="settings-btn" onClick={() => setShowSettings(true)}>
          ⚙️ Settings
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🔑 OpenRouter API Key</h2>
            <p>
              Dapatkan API key gratis di{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
              >
                openrouter.ai/keys
              </a>
            </p>
            <input
              type="password"
              placeholder="sk-or-v1-..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="api-key-input"
            />
            {error && <p className="error-text">{error}</p>}
            <div className="modal-buttons">
              <button
                onClick={() => setShowSettings(false)}
                className="cancel-btn"
              >
                Batal
              </button>
              <button onClick={saveApiKey} className="save-btn">
                Simpan
              </button>
            </div>
            {aiEnabled && (
              <p className="current-key-note">
                ✅ API key sudah tersimpan ({getApiKey().substring(0, 15)}...)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card loss" style={{ gridColumn: "span 2" }}>
          <div className="stat-label">Total Uang Melayang Karena Emosi</div>
          <div className="stat-value loss">
            -${totalLossValue.toLocaleString()}
          </div>
        </div>
        <div className="stat-card total" style={{ gridColumn: "span 2" }}>
          <div className="stat-label">Total Kali Melanggar Aturan</div>
          <div className="stat-value">{totalLossCount}x</div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{loadingProgress || "AI sedang menganalisis kesalahan kamu..."}</p>
        </div>
      )}

      {/* Error State */}
      {error && !showSettings && (
        <div className="error-banner">
          <p>❌ {error}</p>
          <button onClick={() => setShowSettings(true)}>Cek API Key</button>
        </div>
      )}

      {/* Mistakes List */}
      <div className="regret-section">
        <h2 className="section-title">🏆 Top Global Kesalahan Kamu</h2>

        {!aiEnabled ? (
          <div className="empty-state">
            <div className="empty-icon">🔑</div>
            <h3>Setup API Key dulu!</h3>
            <p>
              Klik tombol "Settings" di atas untuk memasukkan OpenRouter API
              key.
              <br />
              Gratis kok, cuma butuh daftar.
            </p>
            <button className="setup-btn" onClick={() => setShowSettings(true)}>
              ⚙️ Setup Sekarang
            </button>
          </div>
        ) : topMistakes.length === 0 && !isLoading ? (
          <div className="empty-state">
            <div className="empty-icon">😇</div>
            <h3>Belum ada kesalahan fatal tercatat</h3>
            <p>Pertahankan disiplin ini! (Atau kamu belum jujur isi jurnal?)</p>
          </div>
        ) : (
          <div className="mistakes-list">
            {topMistakes.map((mistake, idx) => (
              <div key={idx} className="mistake-card">
                <div className="mistake-rank">#{idx + 1}</div>
                <div className="mistake-content">
                  <h3 className="mistake-reason">{mistake.category}</h3>
                  {mistake.examples && mistake.examples.length > 0 && (
                    <div
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "0.8rem",
                        fontStyle: "italic",
                      }}
                    >
                      "{mistake.examples.slice(0, 2).join('", "')}"
                      {mistake.examples.length > 2 && "..."}
                    </div>
                  )}
                  <div className="mistake-stats">
                    <span className="mistake-count">
                      Dilakukan <strong>{mistake.count}x</strong>
                    </span>
                    <span className="mistake-value">
                      Cost: -${mistake.totalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="mistake-bar-bg">
                    <div
                      className="mistake-bar-fill"
                      style={{
                        width: `${
                          (mistake.count / topMistakes[0].count) * 100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .fade-in {
          animation: fadeIn 0.5s ease;
        }

        .back-btn {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          margin-bottom: 1rem;
          transition: all 0.2s;
        }
        .back-btn:hover {
          border-color: var(--text-primary);
          color: var(--text-primary);
        }

        .ai-status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          margin-bottom: 1.5rem;
        }

        .ai-status-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .ai-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .ai-badge.enabled {
          background: rgba(16, 185, 129, 0.2);
          color: var(--profit-green);
        }

        .ai-badge.disabled {
          background: rgba(245, 158, 11, 0.2);
          color: var(--accent-orange);
        }

        .refresh-btn,
        .settings-btn {
          padding: 0.4rem 0.75rem;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s;
        }

        .refresh-btn:hover,
        .settings-btn:hover {
          border-color: var(--accent-teal);
          color: var(--accent-teal);
        }

        .refresh-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .settings-modal {
          background: var(--bg-card);
          border: 1px solid var(--accent-teal);
          border-radius: 20px;
          padding: 2rem;
          max-width: 450px;
          width: 100%;
        }

        .settings-modal h2 {
          margin-bottom: 0.5rem;
        }

        .settings-modal p {
          color: var(--text-secondary);
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .settings-modal a {
          color: var(--accent-teal);
        }

        .api-key-input {
          width: 100%;
          padding: 0.875rem 1rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: var(--text-primary);
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .api-key-input:focus {
          outline: none;
          border-color: var(--accent-teal);
        }

        .error-text {
          color: var(--loss-red);
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }

        .modal-buttons {
          display: flex;
          gap: 0.75rem;
        }

        .cancel-btn,
        .save-btn {
          flex: 1;
          padding: 0.75rem;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-btn {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
        }

        .save-btn {
          background: var(--gradient-teal);
          border: none;
          color: white;
        }

        .current-key-note {
          margin-top: 1rem;
          font-size: 0.8rem;
          color: var(--profit-green);
        }

        .loading-state {
          text-align: center;
          padding: 2rem;
          color: var(--text-secondary);
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border-color);
          border-top-color: var(--accent-teal);
          border-radius: 50%;
          margin: 0 auto 1rem;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-banner {
          background: var(--loss-red-bg);
          border: 1px solid var(--loss-red);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .error-banner p {
          margin: 0;
          color: var(--loss-red);
        }

        .error-banner button {
          padding: 0.5rem 1rem;
          background: var(--loss-red);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
        }

        .setup-btn {
          margin-top: 1rem;
          padding: 0.75rem 1.5rem;
          background: var(--gradient-teal);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .regret-section {
          background: var(--bg-card);
          border: 1px solid var(--loss-red);
          border-radius: 20px;
          padding: 2rem;
          box-shadow: 0 0 40px rgba(239, 68, 68, 0.1);
          position: relative;
          overflow: hidden;
        }

        .regret-section::before {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(
            circle,
            rgba(239, 68, 68, 0.05) 0%,
            transparent 70%
          );
          pointer-events: none;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 1rem;
          color: var(--text-muted);
        }
        .empty-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .mistakes-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          position: relative;
          z-index: 1;
        }

        .mistake-card {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem;
          background: var(--bg-secondary);
          border-radius: 16px;
          border: 1px solid var(--border-color);
          transition: transform 0.2s;
        }
        .mistake-card:hover {
          transform: translateX(5px);
          border-color: var(--loss-red);
        }

        .mistake-rank {
          font-size: 2rem;
          font-weight: 800;
          color: var(--loss-red);
          opacity: 0.5;
          min-width: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mistake-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .mistake-reason {
          font-size: 1.2rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .mistake-stats {
          display: flex;
          gap: 1.5rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        .mistake-count strong {
          color: var(--text-primary);
        }

        .mistake-value {
          color: var(--loss-red);
          font-weight: 600;
        }

        .mistake-bar-bg {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
          overflow: hidden;
        }

        .mistake-bar-fill {
          height: 100%;
          background: var(--loss-red);
          border-radius: 3px;
          box-shadow: 0 0 10px var(--loss-red);
        }

        @media (max-width: 600px) {
          .mistake-card {
            flex-direction: column;
            gap: 0.5rem;
            text-align: center;
          }
          .mistake-rank {
            font-size: 1.5rem;
          }
          .mistake-stats {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default RegretPage;
