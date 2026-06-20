import { useState } from 'react';
import styles from './styles.module.css';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function Calendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const isToday = (day: number) =>
    day === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear();

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Build grid: fill blanks before day 1, then day numbers
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to complete last row (multiple of 7)
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className={styles.calendarWrap}>
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={goToPrevMonth} aria-label="上个月">
          ◀
        </button>
        <span className={styles.monthLabel}>
          {viewYear}年{viewMonth + 1}月
        </span>
        <button className={styles.navBtn} onClick={goToNextMonth} aria-label="下个月">
          ▶
        </button>
        <button className={styles.todayBtn} onClick={goToToday}>
          今天
        </button>
      </div>

      <div className={styles.weekdayRow}>
        {WEEKDAYS.map((w) => (
          <span key={w} className={styles.weekdayCell}>
            {w}
          </span>
        ))}
      </div>

      <div className={styles.dayGrid}>
        {cells.map((day, i) => (
          <div
            key={i}
            className={[
              styles.dayCell,
              day && isToday(day) ? styles.dayToday : '',
              day === null ? styles.dayEmpty : '',
            ].join(' ')}
          >
            {day ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
}
