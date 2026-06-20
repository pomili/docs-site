import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './styles.module.css';

interface Poem {
  content: string;
  origin: string;
  author: string;
  category: string;
}

const API_URL = 'https://v1.jinrishici.com/all.json';

// 兜底诗句，API 失败时使用
const FALLBACK: Poem = {
  content: '床前明月光，疑是地上霜。举头望明月，低头思故乡。',
  origin: '静夜思',
  author: '李白',
  category: '唐诗',
};

export default function PoetryQuote() {
  const [poem, setPoem] = useState<Poem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const prevPoem = useRef<Poem | null>(null);

  const fetchPoem = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('API error');
      const data: Poem = await res.json();
      prevPoem.current = data;
      setPoem(data);
    } catch {
      setError(true);
      // 首次加载失败用兜底
      if (!prevPoem.current) {
        prevPoem.current = FALLBACK;
        setPoem(FALLBACK);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPoem();
  }, [fetchPoem]);

  const display = poem || prevPoem.current;

  return (
    <div className={styles.poemCard}>
      {error && !display ? (
        <>
          <p>加载失败</p>
          <button className={styles.refreshBtn} onClick={fetchPoem}>
            重试
          </button>
        </>
      ) : display ? (
        <>
          <div className={styles.poemContent}>{display.content}</div>
          <div className={styles.poemMeta}>
            —— {display.author}《{display.origin}》
          </div>
          <button className={styles.refreshBtn} onClick={fetchPoem} disabled={loading}>
            {loading ? '加载中...' : '换一首'}
          </button>
        </>
      ) : null}
    </div>
  );
}
