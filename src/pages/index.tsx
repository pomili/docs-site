import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

import styles from './index.module.css';

function Hero() {
  return (
    <div className={styles.hero}>
      <div className={styles.heroInner}>
        <p className={styles.badge}>POMILI</p>
        <h1 className={styles.title}>
          探索 · 构建 · 分享
        </h1>
        <p className={styles.subtitle}>
          一个关于技术、代码与思考的个人空间
        </p>
        <div className={styles.actions}>
          <Link className={styles.btnPrimary} to="/docs/intro">
            阅读文档
          </Link>
          <Link className={styles.btnGhost} to="/blog">
            浏览博客
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({title, desc}: {title: string; desc: string}) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <p className={styles.cardDesc}>{desc}</p>
    </div>
  );
}

function Features() {
  return (
    <div className={styles.features}>
      <div className={styles.featuresInner}>
        <FeatureCard
          title="文档"
          desc="系统的技术文档和教程，记录学习与工作过程中的知识积累。"
        />
        <FeatureCard
          title="博客"
          desc="技术思考与实践记录，分享开发过程中的心得与经验。"
        />
        <FeatureCard
          title="项目"
          desc="开源项目与工具，将想法付诸实践，用代码解决问题。"
        />
      </div>
    </div>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="pomili - 探索、构建、分享">
      <Hero />
      <Features />
    </Layout>
  );
}
