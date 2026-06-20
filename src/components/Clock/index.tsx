import { useState, useEffect } from 'react';
import styles from './styles.module.css';

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]}`;

  return (
    <div className={styles.clockWrap}>
      <div className={styles.timeDisplay}>{timeStr}</div>
      <div className={styles.dateDisplay}>{dateStr}</div>
    </div>
  );
}
