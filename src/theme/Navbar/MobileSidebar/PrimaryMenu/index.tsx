import React, {type ReactNode} from 'react';
import {useThemeConfig} from '@docusaurus/theme-common';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import NavbarItem, {type Props as NavbarItemConfig} from '@theme/NavbarItem';
import {useDocsSidebar} from '@docusaurus/plugin-content-docs/client';
import Link from '@docusaurus/Link';

function useNavbarItems() {
  return useThemeConfig().navbar.items as NavbarItemConfig[];
}

function DocSidebarItem({item, onClick}: {item: any; onClick: () => void}) {
  if (item.type === 'category') {
    return (
      <li>
        <div style={{
          fontWeight: 600,
          fontSize: '0.85rem',
          padding: '6px 12px',
          marginTop: 8,
          color: 'var(--ifm-menu-color)',
        }}>
          {item.label}
        </div>
        <ul className="menu__list" style={{paddingLeft: 12}}>
          {item.items.map((child: any, i: number) => (
            <DocSidebarItem key={i} item={child} onClick={onClick} />
          ))}
        </ul>
      </li>
    );
  }

  if (item.type === 'link' && item.href) {
    return (
      <li>
        <Link
          className="menu__link"
          to={item.href}
          onClick={onClick}
          style={{
            display: 'block',
            padding: '6px 12px',
            fontSize: '0.9rem',
            borderRadius: 4,
          }}>
          {item.label}
        </Link>
      </li>
    );
  }

  return null;
}

export default function NavbarMobilePrimaryMenu(): ReactNode {
  const mobileSidebar = useNavbarMobileSidebar();
  const items = useNavbarItems();
  const docSidebar = useDocsSidebar();

  return (
    <ul className="menu__list">
      {/* 文档页面：显示侧边栏目录 */}
      {docSidebar && (
        <li style={{marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--ifm-border-color)'}}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--ifm-color-content-secondary)',
            padding: '4px 12px',
            marginBottom: 4,
          }}>
            文档目录
          </div>
          <ul className="menu__list">
            {docSidebar.items.map((item: any, i: number) => (
              <DocSidebarItem
                key={i}
                item={item}
                onClick={() => mobileSidebar.toggle()}
              />
            ))}
          </ul>
        </li>
      )}
      {/* 导航栏页面 */}
      {items.map((item, i) => (
        <NavbarItem
          mobile
          {...item}
          onClick={() => mobileSidebar.toggle()}
          key={i}
        />
      ))}
    </ul>
  );
}
