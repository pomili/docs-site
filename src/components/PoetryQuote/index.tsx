import { useState, useEffect, useCallback } from 'react';
import styles from './styles.module.css';

interface Poem {
  content: string;
  origin: string;
  author: string;
  category: string;
}

const API_URL = 'https://v1.jinrishici.com/all.json';

export default function PoetryQuote() {
  const [poem, setPoem] = useState<Poem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPoem = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('API error');
      const data: Poem = await res.json();
      setPoem(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPoem();
  }, [fetchPoem]);

  if (loading) {
    return <div className={styles.poemCard}>加载中...</div>;
  }

  if (error) {
    return (
      <div className={styles.poemCard}>
        <p>加载失败，请稍后重试</p>
        <button className={styles.refreshBtn} onClick={fetchPoem}>
          重试
        </button>
      </div>
    );
  }

  if (!poem) return null;

  return (
    <div className={styles.poemCard}>
      <div className={styles.poemContent}>{poem.content}</div>
      <div className={styles.poemMeta}>
        —— {poem.author}《{poem.origin}》
      </div>
      <button className={styles.refreshBtn} onClick={fetchPoem}>
        换一首
      </button>
    </div>
  );
}
