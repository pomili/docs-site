import type {ReactNode} from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import Calendar from '@site/src/components/Calendar';
import Clock from '@site/src/components/Clock';
import PoetryQuote from '@site/src/components/PoetryQuote';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description={siteConfig.tagline}>
      <HomepageHeader />
      <main className={styles.pageBody}>
        <div className={styles.row}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>日历</h2>
            <Calendar />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>时间</h2>
            <Clock />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>古诗词</h2>
            <PoetryQuote />
          </section>
        </div>
      </main>
    </Layout>
  );
}
