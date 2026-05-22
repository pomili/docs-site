import type {ReactNode} from 'react';
import Layout from '@theme/Layout';
import styles from './tools.module.css';

interface LinkItem {
  name: string;
  url: string;
}

const embedded: LinkItem[] = [
  { name: 'ARM GNU Toolchain', url: 'https://developer.arm.com/tools-and-software/open-source-software/developer-tools/gnu-toolchain' },
  { name: 'STM32CubeMX', url: 'https://www.st.com/en/development-tools/stm32cubemx.html' },
  { name: 'OpenOCD', url: 'https://openocd.org/' },
  { name: 'CMSIS-DAP', url: 'https://arm-software.github.io/CMSIS_5/DAP/html/index.html' },
  { name: 'STM32 参考手册', url: 'https://www.st.com/en/microcontrollers-microprocessors/stm32-32-bit-arm-cortex-mcus.html#resource' },
  { name: 'SEGGER Ozone', url: 'https://www.segger.com/products/development-tools/ozone-j-link-debugger/' },
  { name: 'Keil MDK', url: 'https://www.keil.com/' },
  { name: 'FreeRTOS', url: 'https://www.freertos.org/' },
  { name: 'LVGL', url: 'https://lvgl.io/' },
  { name: 'ESP-IDF', url: 'https://docs.espressif.com/projects/esp-idf/' },
];

const general: LinkItem[] = [
  { name: 'VS Code', url: 'https://code.visualstudio.com/' },
  { name: 'CMake 文档', url: 'https://cmake.org/documentation/' },
  { name: 'Git 手册', url: 'https://git-scm.com/docs' },
  { name: 'Docker Hub', url: 'https://hub.docker.com/' },
  { name: 'Oh My Zsh', url: 'https://ohmyz.sh/' },
  { name: 'PowerShell', url: 'https://learn.microsoft.com/en-us/powershell/' },
  { name: 'Regex101', url: 'https://regex101.com/' },
  { name: 'cURL 手册', url: 'https://curl.se/docs/' },
  { name: 'DevDocs', url: 'https://devdocs.io/' },
  { name: 'QuickType', url: 'https://app.quicktype.io/' },
];

const resources: LinkItem[] = [
  { name: 'GitHub Trending', url: 'https://github.com/trending' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com/' },
  { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/' },
  { name: 'CS 自学指南', url: 'https://csdiy.wiki/' },
  { name: 'r/embedded', url: 'https://www.reddit.com/r/embedded/' },
  { name: 'EEVblog', url: 'https://www.eevblog.com/forum/' },
  { name: 'Hackaday', url: 'https://hackaday.com/' },
  { name: 'Embedded Artistry', url: 'https://embeddedartistry.com/' },
  { name: 'Docusaurus', url: 'https://docusaurus.io/' },
  { name: 'Node.js 文档', url: 'https://nodejs.org/docs/' },
];

function Section({title, items, dotClass}: {title: string; items: LinkItem[]; dotClass: string}) {
  return (
    <div className={styles.category}>
      <h2 className={styles.categoryTitle}>{title}</h2>
      <div className={styles.tags}>
        {items.map((item) => (
          <a key={item.name} className={styles.tag} href={item.url} target="_blank" rel="noopener noreferrer">
            <span className={`${styles.dot} ${dotClass}`} />
            {item.name}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function Tools(): ReactNode {
  return (
    <Layout title="工具导航" description="嵌入式、开发工具、技术资源导航">
      <div className={styles.wrap}>
        <div className={styles.hero}>
          <h1 className={styles.title}>工具导航</h1>
          <p className={styles.subtitle}>常用工具与技术资源，点击直达</p>
        </div>

        <Section title="嵌入式工具链" items={embedded} dotClass={styles.dotEmbedded} />
        <Section title="通用开发工具" items={general} dotClass={styles.dotGeneral} />
        <Section title="技术资源" items={resources} dotClass={styles.dotResource} />
      </div>
    </Layout>
  );
}
