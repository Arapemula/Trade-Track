import { useState, useEffect, useCallback } from "react";
import "./App.css";

// Constants
const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const WEEKS = ["Week 1", "Week 2", "Week 3", "Week 4"];
const MAX_LOSSES_PER_DAY = 2;

// Helper to get today's date key
const getTodayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
};

// Helper to get current day index (0 = Monday/Senin)
const getCurrentDayIndex = () => {
  const dayOfWeek = new Date().getDay();
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday = 0
};

// Helper to get current week index (0-3)
const getCurrentWeekIndex = () => {
  const now = new Date();
  const weekOfMonth = Math.ceil(now.getDate() / 7);
  return Math.min(weekOfMonth - 1, 3);
};

function App() {
  // Initialize trades state from localStorage or empty
  const [trades, setTrades] = useState(() => {
    const saved = localStorage.getItem("tradingJournal");
    if (saved) {
      return JSON.parse(saved);
    }
    // Initialize empty trades structure
    const initial = {};
    WEEKS.forEach((week, weekIdx) => {
      initial[weekIdx] = {};
      DAYS.forEach((day, dayIdx) => {
        initial[weekIdx][dayIdx] = []; // Empty array - no limit on trades
      });
    });
    return initial;
  });

  // Lock state for days that hit 2 losses
  const [lockedDays, setLockedDays] = useState(() => {
    const saved = localStorage.getItem("lockedDays");
    if (saved) {
      return JSON.parse(saved);
    }
    return {};
  });

  // Show lock alert modal
  const [showLockAlert, setShowLockAlert] = useState(false);
  const [lockAlertData, setLockAlertData] = useState(null);

  // Promise unlock modal (for next day after lock)
  const [showPromiseModal, setShowPromiseModal] = useState(false);
  const [promiseInput, setPromiseInput] = useState("");
  const [hasPromised, setHasPromised] = useState(() => {
    const saved = localStorage.getItem("tradingPromise");
    if (saved) {
      return JSON.parse(saved);
    }
    return {};
  });

  // Loss reason modal
  const [showLossReasonModal, setShowLossReasonModal] = useState(false);
  const [lossReasonInput, setLossReasonInput] = useState("");
  const [confessionChecked, setConfessionChecked] = useState(false);
  const [pendingLossData, setPendingLossData] = useState(null);

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // Learning notes
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem("tradingNotes");
    if (saved) {
      return JSON.parse(saved);
    }
    return [];
  });
  const [newNote, setNewNote] = useState("");
  const [showNotes, setShowNotes] = useState(true);

  // Current day/week info
  const currentDayIdx = getCurrentDayIndex();
  const currentWeekIdx = getCurrentWeekIndex();

  // Save to localStorage whenever trades change
  useEffect(() => {
    localStorage.setItem("tradingJournal", JSON.stringify(trades));
  }, [trades]);

  // Save locked days to localStorage
  useEffect(() => {
    localStorage.setItem("lockedDays", JSON.stringify(lockedDays));
  }, [lockedDays]);

  // Save notes to localStorage
  useEffect(() => {
    localStorage.setItem("tradingNotes", JSON.stringify(notes));
  }, [notes]);

  // Save promise state to localStorage
  useEffect(() => {
    localStorage.setItem("tradingPromise", JSON.stringify(hasPromised));
  }, [hasPromised]);

  // Check if user was locked yesterday and needs to promise
  useEffect(() => {
    const today = getTodayKey();
    const yesterdayLockKey = localStorage.getItem("yesterdayLocked");

    if (yesterdayLockKey && !hasPromised[today]) {
      setShowPromiseModal(true);
    }
  }, [hasPromised]);

  // Check and clear expired locks at midnight
  useEffect(() => {
    const checkLocks = () => {
      const today = getTodayKey();
      const updatedLocks = { ...lockedDays };
      let changed = false;

      Object.keys(updatedLocks).forEach((key) => {
        if (updatedLocks[key].dateKey !== today) {
          delete updatedLocks[key];
          changed = true;
        }
      });

      if (changed) {
        setLockedDays(updatedLocks);
      }
    };

    checkLocks();
    const interval = setInterval(checkLocks, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [lockedDays]);

  // Add toast notification
  const addToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // Count completed losses for a specific day (type=loss AND amount > 0)
  const countLosses = useCallback(
    (weekIdx, dayIdx) => {
      const dayTrades = trades[weekIdx]?.[dayIdx] || [];
      return dayTrades.filter(
        (t) => t.type === "loss" && t.amount && parseFloat(t.amount) > 0
      ).length;
    },
    [trades]
  );

  // Check if a day is locked (2x loss reached)
  const isDayLocked = useCallback(
    (weekIdx, dayIdx) => {
      const today = getTodayKey();
      const lockKey = `${weekIdx}-${dayIdx}`;
      const lock = lockedDays[lockKey];

      if (lock && lock.dateKey === today) {
        return true;
      }
      return false;
    },
    [lockedDays]
  );

  // Check if a day is today (editable)
  const isToday = (weekIdx, dayIdx) => {
    return weekIdx === currentWeekIdx && dayIdx === currentDayIdx;
  };

  // Add new trade for today
  const addNewTrade = () => {
    if (isDayLocked(currentWeekIdx, currentDayIdx)) {
      addToast("Hari ini sudah terkunci karena 2x Loss!", "error");
      return;
    }

    const newTrades = JSON.parse(JSON.stringify(trades));
    if (!newTrades[currentWeekIdx]) {
      newTrades[currentWeekIdx] = {};
    }
    if (!newTrades[currentWeekIdx][currentDayIdx]) {
      newTrades[currentWeekIdx][currentDayIdx] = [];
    }

    newTrades[currentWeekIdx][currentDayIdx].push({
      type: "",
      amount: "",
      id: Date.now(),
    });

    setTrades(newTrades);
  };

  // Handle trade input change
  const handleTradeChange = (weekIdx, dayIdx, rowIdx, field, value) => {
    // Only allow editing today
    if (!isToday(weekIdx, dayIdx)) {
      addToast("Hanya bisa edit hari ini!", "warning");
      return;
    }

    // Check if day is locked
    if (isDayLocked(weekIdx, dayIdx)) {
      addToast("Hari ini sudah terkunci! Coba lagi besok.", "error");
      return;
    }

    const newTrades = JSON.parse(JSON.stringify(trades));

    // If selecting "loss" type, show the reason modal instead of directly setting
    if (field === "type" && value === "loss") {
      const currentLossCount = countLosses(weekIdx, dayIdx);
      const isSecondLoss = currentLossCount >= 1;

      // Store pending data and show modal
      setPendingLossData({
        weekIdx,
        dayIdx,
        rowIdx,
        isSecondLoss,
        amount: newTrades[weekIdx][dayIdx][rowIdx].amount,
      });
      setLossReasonInput("");
      setConfessionChecked(false);
      setShowLossReasonModal(true);
      return; // Don't set yet, wait for modal confirmation
    }

    newTrades[weekIdx][dayIdx][rowIdx][field] = value;
    setTrades(newTrades);
  };

  // Confirm loss with reason
  const confirmLossWithReason = () => {
    if (!pendingLossData) return;

    const { weekIdx, dayIdx, rowIdx, isSecondLoss } = pendingLossData;

    // Validate
    if (!lossReasonInput.trim()) {
      addToast("Harus isi alasan kenapa loss!", "error");
      return;
    }

    if (isSecondLoss && !confessionChecked) {
      addToast("Harus centang pengakuan!", "error");
      return;
    }

    // Now apply the loss
    const newTrades = JSON.parse(JSON.stringify(trades));
    newTrades[weekIdx][dayIdx][rowIdx].type = "loss";
    newTrades[weekIdx][dayIdx][rowIdx].reason = lossReasonInput.trim();

    // Check for 2 COMPLETED losses (type=loss AND amount filled)
    const updatedDayTrades = newTrades[weekIdx][dayIdx];
    const completedLossCount = updatedDayTrades.filter(
      (t) => t.type === "loss" && t.amount && parseFloat(t.amount) > 0
    ).length;

    if (completedLossCount >= MAX_LOSSES_PER_DAY) {
      const today = getTodayKey();
      const lockKey = `${weekIdx}-${dayIdx}`;

      // Save that today got locked (for tomorrow's promise)
      localStorage.setItem("yesterdayLocked", today);

      setLockedDays((prev) => ({
        ...prev,
        [lockKey]: {
          dateKey: today,
          timestamp: Date.now(),
        },
      }));

      setLockAlertData({
        weekIdx,
        dayIdx,
        dayName: DAYS[dayIdx],
        weekName: WEEKS[weekIdx],
      });

      // Close reason modal first, then show lock alert
      setShowLossReasonModal(false);
      setPendingLossData(null);
      setTrades(newTrades);

      setTimeout(() => {
        setShowLockAlert(true);
      }, 300);
      return;
    }

    setTrades(newTrades);
    setShowLossReasonModal(false);
    setPendingLossData(null);
    addToast("Loss tercatat dengan alasan.", "warning");
  };

  // Cancel loss selection
  const cancelLossSelection = () => {
    setShowLossReasonModal(false);
    setPendingLossData(null);
    setLossReasonInput("");
    setConfessionChecked(false);
  };

  // Submit promise to unlock
  const submitPromise = () => {
    const requiredPromise =
      "Saya berjanji tidak akan mengulangi kesalahan yang sama";

    if (promiseInput.trim() !== requiredPromise) {
      addToast("Ketik janji dengan benar!", "error");
      return;
    }

    const today = getTodayKey();
    setHasPromised((prev) => ({
      ...prev,
      [today]: true,
    }));

    localStorage.removeItem("yesterdayLocked");
    setShowPromiseModal(false);
    setPromiseInput("");
    addToast("Janji diterima. Semoga hari ini lebih baik!", "success");
  };

  // Delete a trade
  const deleteTrade = (weekIdx, dayIdx, rowIdx) => {
    if (!isToday(weekIdx, dayIdx)) {
      addToast("Hanya bisa hapus trade hari ini!", "warning");
      return;
    }

    const newTrades = JSON.parse(JSON.stringify(trades));
    newTrades[weekIdx][dayIdx].splice(rowIdx, 1);
    setTrades(newTrades);
    addToast("Trade dihapus!", "success");
  };

  // Calculate day total
  const calculateDayTotal = (weekIdx, dayIdx) => {
    const dayTrades = trades[weekIdx]?.[dayIdx] || [];
    return dayTrades.reduce((sum, trade) => {
      if (!trade.amount) return sum;
      const amount = parseFloat(trade.amount) || 0;
      return trade.type === "profit" ? sum + amount : sum - amount;
    }, 0);
  };

  // Calculate week total
  const calculateWeekTotal = (weekIdx) => {
    return DAYS.reduce((sum, _, dayIdx) => {
      return sum + calculateDayTotal(weekIdx, dayIdx);
    }, 0);
  };

  // Calculate overall stats
  const calculateStats = () => {
    let totalProfit = 0;
    let totalLoss = 0;
    let winCount = 0;
    let lossCount = 0;

    WEEKS.forEach((_, weekIdx) => {
      DAYS.forEach((_, dayIdx) => {
        const dayTrades = trades[weekIdx]?.[dayIdx] || [];
        dayTrades.forEach((trade) => {
          if (trade.amount) {
            const amount = parseFloat(trade.amount) || 0;
            if (trade.type === "profit") {
              totalProfit += amount;
              winCount++;
            } else if (trade.type === "loss") {
              totalLoss += amount;
              lossCount++;
            }
          }
        });
      });
    });

    const totalTrades = winCount + lossCount;
    const winRate =
      totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(1) : 0;
    const netTotal = totalProfit - totalLoss;

    return { totalProfit, totalLoss, netTotal, winRate, totalTrades };
  };

  // Reset all data
  const resetAllData = () => {
    const confirmed = window.confirm(
      "Yakin ingin hapus semua data? Tindakan ini tidak bisa dibatalkan."
    );

    if (confirmed) {
      const initial = {};
      WEEKS.forEach((week, weekIdx) => {
        initial[weekIdx] = {};
        DAYS.forEach((day, dayIdx) => {
          initial[weekIdx][dayIdx] = [];
        });
      });
      setTrades(initial);
      setLockedDays({});
      setNotes([]);
      addToast("Semua data berhasil dihapus!", "warning");
    }
  };

  // Get time until midnight
  const getTimeUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours} jam ${minutes} menit`;
  };

  // Add a new learning note
  const addNote = () => {
    if (!newNote.trim()) return;

    const note = {
      id: Date.now(),
      text: newNote.trim(),
      date: new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    };

    setNotes((prev) => [note, ...prev]);
    setNewNote("");
    addToast("Catatan ditambahkan!", "success");
  };

  // Delete a note
  const deleteNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    addToast("Catatan dihapus!", "warning");
  };

  // Get today's trades
  const getTodayTrades = () => {
    return trades[currentWeekIdx]?.[currentDayIdx] || [];
  };

  const stats = calculateStats();
  const todayTrades = getTodayTrades();
  const todayLocked = isDayLocked(currentWeekIdx, currentDayIdx);
  const todayLossCount = countLosses(currentWeekIdx, currentDayIdx);

  return (
    <div className="container">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {/* Lock Alert Modal */}
      {showLockAlert && lockAlertData && (
        <div className="lock-overlay" onClick={() => setShowLockAlert(false)}>
          <div className="lock-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lock-icon">🔒</div>
            <h2 className="lock-title">Trading Dihentikan!</h2>
            <p className="lock-message">
              Kamu sudah mengalami <strong>2x Loss</strong> pada hari{" "}
              <strong>{lockAlertData.dayName}</strong> ({lockAlertData.weekName}
              ).
              <br />
              <br />
              Untuk melindungi portofolio kamu, trading pada hari ini telah
              dinonaktifkan. Gunakan waktu ini untuk evaluasi dan istirahat.
            </p>
            <p className="lock-timer">
              ⏰ Trading bisa dilanjutkan dalam: {getTimeUntilMidnight()}
            </p>
            <button
              className="lock-button"
              onClick={() => setShowLockAlert(false)}
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Promise Modal - After Yesterday Lock */}
      {showPromiseModal && (
        <div className="lock-overlay">
          <div className="promise-modal" onClick={(e) => e.stopPropagation()}>
            <div className="promise-icon">✍️</div>
            <h2 className="promise-title">Sebelum Trading Hari Ini...</h2>
            <p className="promise-message">
              Kemarin kamu mengalami <strong>2x Loss</strong> dan trading
              terkunci.
              <br />
              <br />
              Sebelum melanjutkan trading hari ini, ketik janji berikut dengan{" "}
              <strong>PERSIS</strong>:
            </p>
            <div className="promise-text-box">
              "Saya berjanji tidak akan mengulangi kesalahan yang sama"
            </div>
            <input
              type="text"
              className="promise-input"
              placeholder="Ketik janji di sini..."
              value={promiseInput}
              onChange={(e) => setPromiseInput(e.target.value)}
            />
            <button className="promise-button" onClick={submitPromise}>
              ✅ Konfirmasi Janji
            </button>
          </div>
        </div>
      )}

      {/* Loss Reason Modal */}
      {showLossReasonModal && pendingLossData && (
        <div className="lock-overlay">
          <div
            className="loss-reason-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="loss-reason-icon">
              {pendingLossData.isSecondLoss ? "😤" : "😔"}
            </div>
            <h2 className="loss-reason-title">
              {pendingLossData.isSecondLoss ? "Loss Ke-2! 🚫" : "Loss Ke-1"}
            </h2>
            <p className="loss-reason-message">
              {pendingLossData.isSecondLoss
                ? "Ini adalah loss ke-2 kamu hari ini. Setelah ini trading akan TERKUNCI."
                : "Sebelum mencatat loss, jelaskan alasan kenapa kamu loss."}
            </p>

            <div className="loss-reason-form">
              <label className="loss-reason-label">Alasan Loss:</label>
              <textarea
                className="loss-reason-textarea"
                placeholder="Contoh: Entry terlalu cepat tanpa konfirmasi, tidak pasang stoploss, dll..."
                value={lossReasonInput}
                onChange={(e) => setLossReasonInput(e.target.value)}
                rows={3}
              />

              {pendingLossData.isSecondLoss && (
                <div className="confession-wrapper">
                  <label className="confession-label">
                    <input
                      type="checkbox"
                      checked={confessionChecked}
                      onChange={(e) => setConfessionChecked(e.target.checked)}
                    />
                    <span className="confession-text">
                      Saya akui saya <strong>TOLOL</strong> karena loss 2x dalam
                      sehari 🤡
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="loss-reason-buttons">
              <button className="loss-cancel-btn" onClick={cancelLossSelection}>
                ❌ Batal
              </button>
              <button
                className="loss-confirm-btn"
                onClick={confirmLossWithReason}
              >
                ✅ Konfirmasi Loss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <h1>📊 Trading Journal</h1>
        <p>Lacak profit & loss trading kamu dengan bijak</p>
      </header>

      {/* Learning Notes Panel - Fixed Top Right */}
      <div className={`notes-panel ${showNotes ? "open" : "collapsed"}`}>
        <div className="notes-header" onClick={() => setShowNotes(!showNotes)}>
          <h3>📝 Catatan Pembelajaran</h3>
          <span className="notes-toggle">{showNotes ? "−" : "+"}</span>
        </div>

        {showNotes && (
          <div className="notes-content">
            <div className="notes-input-wrapper">
              <input
                type="text"
                className="notes-input"
                placeholder="Tulis pelajaran hari ini..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addNote()}
              />
              <button className="notes-add-btn" onClick={addNote}>
                ➕
              </button>
            </div>

            <div className="notes-list">
              {notes.length === 0 ? (
                <p className="notes-empty">Belum ada catatan</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="note-item">
                    <div className="note-content">
                      <p className="note-text">{note.text}</p>
                      <span className="note-date">{note.date}</span>
                    </div>
                    <button
                      className="note-delete"
                      onClick={() => deleteNote(note.id)}
                      title="Hapus catatan"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card profit">
          <div className="stat-label">Total Profit</div>
          <div className="stat-value profit">
            +${stats.totalProfit.toLocaleString()}
          </div>
        </div>
        <div className="stat-card loss">
          <div className="stat-label">Total Loss</div>
          <div className="stat-value loss">
            -${stats.totalLoss.toLocaleString()}
          </div>
        </div>
        <div className="stat-card total">
          <div className="stat-label">Net Profit/Loss</div>
          <div
            className={`stat-value ${stats.netTotal >= 0 ? "profit" : "loss"}`}
          >
            {stats.netTotal >= 0 ? "+" : ""}
            {stats.netTotal.toLocaleString()}$
          </div>
        </div>
        <div className="stat-card rate">
          <div className="stat-label">Win Rate</div>
          <div className="stat-value">{stats.winRate}%</div>
        </div>
      </div>

      {/* Today's Trading Section */}
      <div className="today-section">
        <div className="today-header">
          <div className="today-info">
            <h2>
              📅 {DAYS[currentDayIdx]}, {WEEKS[currentWeekIdx]}
            </h2>
            <p className="today-subtitle">
              {todayLocked ? (
                <span className="status-locked">
                  🔒 Terkunci - 2x Loss tercapai
                </span>
              ) : (
                <span className="status-active">
                  ✅ Aktif - Loss: {todayLossCount}/{MAX_LOSSES_PER_DAY}
                </span>
              )}
            </p>
          </div>
          <button
            className="add-trade-btn"
            onClick={addNewTrade}
            disabled={todayLocked}
          >
            ➕ Tambah Trade
          </button>
        </div>

        {/* Today's Trades List */}
        <div className="trades-list">
          {todayTrades.length === 0 ? (
            <div className="empty-trades">
              <p>Belum ada trade hari ini</p>
              <p className="empty-hint">Klik "Tambah Trade" untuk memulai</p>
            </div>
          ) : (
            todayTrades.map((trade, idx) => (
              <div key={trade.id || idx} className={`trade-card ${trade.type}`}>
                <div className="trade-number">#{idx + 1}</div>
                <div className="trade-inputs">
                  <div className="amount-wrapper">
                    <span className="currency">$</span>
                    <input
                      type="number"
                      className="amount-input"
                      placeholder="0.00"
                      value={trade.amount}
                      onChange={(e) =>
                        handleTradeChange(
                          currentWeekIdx,
                          currentDayIdx,
                          idx,
                          "amount",
                          e.target.value
                        )
                      }
                      disabled={todayLocked}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <select
                    className={`type-select ${trade.type}`}
                    value={trade.type}
                    onChange={(e) =>
                      handleTradeChange(
                        currentWeekIdx,
                        currentDayIdx,
                        idx,
                        "type",
                        e.target.value
                      )
                    }
                    disabled={todayLocked || !trade.amount}
                  >
                    <option value="">-- Pilih --</option>
                    <option value="profit">✅ Profit</option>
                    <option value="loss">❌ Loss</option>
                  </select>
                </div>
                <button
                  className="delete-btn"
                  onClick={() =>
                    deleteTrade(currentWeekIdx, currentDayIdx, idx)
                  }
                  disabled={todayLocked}
                  title="Hapus trade"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>

        {/* Today's Total */}
        {todayTrades.length > 0 && (
          <div className="today-total">
            <span>Total Hari Ini:</span>
            <span
              className={`total-value ${
                calculateDayTotal(currentWeekIdx, currentDayIdx) >= 0
                  ? "profit"
                  : "loss"
              }`}
            >
              {calculateDayTotal(currentWeekIdx, currentDayIdx) >= 0 ? "+" : ""}
              $
              {calculateDayTotal(
                currentWeekIdx,
                currentDayIdx
              ).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Weekly History */}
      <div className="history-section">
        <h2 className="section-title">📈 Riwayat Mingguan</h2>

        {WEEKS.map((weekName, weekIdx) => {
          const weekTotal = calculateWeekTotal(weekIdx);
          const hasAnyTrades = DAYS.some(
            (_, dayIdx) => (trades[weekIdx]?.[dayIdx] || []).length > 0
          );

          if (!hasAnyTrades && weekIdx !== currentWeekIdx) return null;

          return (
            <div key={weekIdx} className="week-container">
              <div className="week-header">
                <span className="week-title">
                  {weekName}
                  {weekIdx === currentWeekIdx && (
                    <span className="current-badge">Minggu Ini</span>
                  )}
                </span>
                <span
                  className={`week-total ${weekTotal >= 0 ? "profit" : "loss"}`}
                >
                  {weekTotal >= 0 ? "+" : ""}${weekTotal.toLocaleString()}
                </span>
              </div>
              <div className="week-days">
                {DAYS.map((dayName, dayIdx) => {
                  const dayTrades = trades[weekIdx]?.[dayIdx] || [];
                  const dayTotal = calculateDayTotal(weekIdx, dayIdx);
                  const isTodayCell = isToday(weekIdx, dayIdx);
                  const isLocked = isDayLocked(weekIdx, dayIdx);

                  return (
                    <div
                      key={dayIdx}
                      className={`day-card ${isTodayCell ? "today" : ""} ${
                        isLocked ? "locked" : ""
                      }`}
                    >
                      <div className="day-name">
                        {dayName}
                        {isTodayCell && <span className="today-dot"></span>}
                        {isLocked && (
                          <span className="lock-icon-small">🔒</span>
                        )}
                      </div>
                      <div className="day-trades-count">
                        {dayTrades.length} trade
                        {dayTrades.length !== 1 ? "s" : ""}
                      </div>
                      <div
                        className={`day-total ${
                          dayTotal > 0 ? "profit" : dayTotal < 0 ? "loss" : ""
                        }`}
                      >
                        {dayTrades.length > 0 ? (
                          <>
                            {dayTotal >= 0 ? "+" : ""}$
                            {dayTotal.toLocaleString()}
                          </>
                        ) : (
                          <span className="no-data">-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions Bar */}
      <div className="actions-bar">
        <button className="action-btn danger" onClick={resetAllData}>
          🗑️ Reset Semua Data
        </button>
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>
          💡 Tips: Jika sudah loss 2x dalam sehari, istirahat dan evaluasi
          strategi kamu.
        </p>
        <p className="footer-copyright">
          © 2026 Trading Journal - Trade Wisely! 📈
        </p>
      </footer>
    </div>
  );
}

export default App;
