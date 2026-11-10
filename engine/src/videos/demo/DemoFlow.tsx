// DemoFlow — демо-композиция FlowNode/DottedLink/MacWindow, 60fps (первая
// 60fps-композиция engine, см. README «Как завести новый ролик»). Тема
// noir. Сцена-накопитель (правило темпа 23): MacWindow finder (6 файлов) в
// верхней половине появляется на 0.5с и остаётся, затем три FlowNode
// прилетают по одному с 4с интервалом 1.2с, DottedLink рисуется после
// каждого следующего узла — ничего не исчезает до конца ролика.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Background } from '../../lib/Background';
import { MacWindow } from '../../lib/MacWindow';
import { FlowNode } from '../../lib/FlowNode';
import { DottedLink } from '../../lib/DottedLink';
import { noirTheme } from '../../themes/noir';

export const DEMO_FLOW_FPS = 60;
export const DEMO_FLOW_DURATION = 12 * DEMO_FLOW_FPS; // 720f

const theme = noirTheme;

const NODE_X = 90;
const NODE_W = 900;
// MacWindow finder (6 файлов, 2 ряда) с 2026-09-04 считает высоту сама —
// заканчивается сразу под вторым рядом (y=100, высота ~368) — узлы схемы
// начинаются сразу под окном с тем же шагом 300px, что и раньше.
const N1_Y = 560;
const N2_Y = 860;
const N3_Y = 1160;
const NODE_H = 116; // высота карточки FlowNode (72 иконка + паддинги)

export const DemoFlow: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
    <Background theme={theme} />

    <MacWindow
      theme={theme}
      title="reelcraft — vault"
      x={40}
      y={100}
      width={1000}
      variant="finder"
      enterFrame={0.5 * DEMO_FLOW_FPS}
      sidebar={['reels', 'ideas', 'drafts', 'published']}
      items={[
        { name: 'obsidian.md', kind: 'file' },
        { name: 'claude', kind: 'folder' },
        { name: 'telegram.md', kind: 'file' },
        { name: 'storyboard', kind: 'folder' },
        { name: 'transcript.json', kind: 'file' },
        { name: 'assets', kind: 'folder' },
      ]}
    />

    <FlowNode
      theme={theme}
      icon="obsidian"
      title="OBSIDIAN"
      caption="заметка идеи"
      x={NODE_X}
      y={N1_Y}
      width={NODE_W}
      enterFrame={4 * DEMO_FLOW_FPS}
    />
    <FlowNode
      theme={theme}
      icon="claude"
      title="CLAUDE"
      caption="сборка ролика"
      x={NODE_X}
      y={N2_Y}
      width={NODE_W}
      enterFrame={5.2 * DEMO_FLOW_FPS}
    />
    <FlowNode
      theme={theme}
      icon="telegram"
      title="TELEGRAM"
      caption="публикация в канал"
      x={NODE_X}
      y={N3_Y}
      width={NODE_W}
      enterFrame={6.4 * DEMO_FLOW_FPS}
    />

    <DottedLink
      theme={theme}
      from={{ x: NODE_X + NODE_W / 2, y: N1_Y + NODE_H }}
      to={{ x: NODE_X + NODE_W / 2, y: N2_Y }}
      label="1 шаг"
      drawFrame={5.2 * DEMO_FLOW_FPS + 0.4 * DEMO_FLOW_FPS}
    />
    <DottedLink
      theme={theme}
      from={{ x: NODE_X + NODE_W / 2, y: N2_Y + NODE_H }}
      to={{ x: NODE_X + NODE_W / 2, y: N3_Y }}
      label="2 шаг"
      drawFrame={6.4 * DEMO_FLOW_FPS + 0.4 * DEMO_FLOW_FPS}
    />
  </AbsoluteFill>
);
