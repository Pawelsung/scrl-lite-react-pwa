import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Line, Text as KText, Image as KImage, Transformer } from 'react-konva'
import useImage from 'use-image'

const RATIOS = {
  '4:5': { w: 4, h: 5 },
  '1:1': { w: 1, h: 1 },
  '16:9': { w: 16, h: 9 },
  '9:16': { w: 9, h: 16 }
}

const TEMPLATES = [
  {
    id: 'magazine',
    name: '雜誌留白',
    build: (sliceWidth, height, count) => [
      { type: 'rect', x: 56, y: 56, width: sliceWidth * count - 112, height: height - 112, radius: 28, stroke: '#ffffff', strokeWidth: 3, opacity: 0.95 },
      { type: 'text', x: 96, y: 90, text: 'Your Story', fontSize: 78, fill: '#111111', fontStyle: 'bold', width: sliceWidth * count - 192 }
    ]
  },
  {
    id: 'split',
    name: '左右文圖',
    build: (sliceWidth, height, count) => [
      { type: 'rect', x: sliceWidth * 0.18, y: height * 0.12, width: sliceWidth * 1.25, height: height * 0.76, radius: 28, fill: 'rgba(255,255,255,.18)', stroke: '#ffffff', strokeWidth: 2 },
      { type: 'text', x: sliceWidth * 1.7, y: height * 0.28, text: 'Minimal\nCarousel', fontSize: 88, fill: '#ffffff', fontStyle: 'bold', width: sliceWidth * 1.2 }
    ]
  },
  {
    id: 'film',
    name: '底片框',
    build: (sliceWidth, height, count) => {
      const items = []
      for (let i = 0; i < count; i += 1) {
        items.push({ type: 'rect', x: i * sliceWidth + 36, y: 36, width: sliceWidth - 72, height: height - 72, radius: 24, fill: 'rgba(255,255,255,.05)', stroke: '#f2f2f2', strokeWidth: 2 })
      }
      return items
    }
  },
  {
    id: 'headline',
    name: '大標題封面',
    build: (sliceWidth, height, count) => [
      { type: 'rect', x: 0, y: height - 280, width: sliceWidth * count, height: 280, fill: 'rgba(0,0,0,.42)' },
      { type: 'text', x: 72, y: height - 220, text: 'Add a strong headline', fontSize: 96, fill: '#ffffff', fontStyle: 'bold', width: sliceWidth * count - 144 }
    ]
  }
]

const uid = () => Math.random().toString(36).slice(2, 10)

function CanvasImage({ shape, isSelected, onSelect, onChange }) {
  const [image] = useImage(shape.src, 'anonymous')
  const shapeRef = useRef(null)
  const trRef = useRef(null)

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  return (
    <>
      <KImage
        ref={shapeRef}
        image={image}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        rotation={shape.rotation || 0}
        opacity={shape.opacity ?? 1}
        cornerRadius={shape.radius || 0}
        shadowBlur={shape.shadowBlur || 0}
        shadowOpacity={shape.shadowBlur ? 0.26 : 0}
        shadowOffsetY={shape.shadowBlur ? 8 : 0}
        stroke={shape.stroke || undefined}
        strokeWidth={shape.strokeWidth || 0}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ ...shape, x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const node = shapeRef.current
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onChange({
            ...shape,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            width: Math.max(40, node.width() * scaleX),
            height: Math.max(40, node.height() * scaleY)
          })
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          keepRatio
          rotateEnabled
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          borderStroke="#7aa2ff"
          anchorStroke="#7aa2ff"
          anchorFill="#0f1115"
          anchorSize={10}
        />
      )}
    </>
  )
}

function CanvasText({ shape, isSelected, onSelect, onChange }) {
  const textRef = useRef(null)
  const trRef = useRef(null)

  useEffect(() => {
    if (isSelected && trRef.current && textRef.current) {
      trRef.current.nodes([textRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  return (
    <>
      <KText
        ref={textRef}
        x={shape.x}
        y={shape.y}
        text={shape.text}
        width={shape.width}
        fontSize={shape.fontSize}
        fill={shape.fill}
        fontStyle={shape.fontStyle || 'normal'}
        align={shape.align || 'left'}
        lineHeight={1.08}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ ...shape, x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const node = textRef.current
          const scaleX = node.scaleX()
          node.scaleX(1)
          node.scaleY(1)
          onChange({
            ...shape,
            x: node.x(),
            y: node.y(),
            width: Math.max(120, node.width() * scaleX),
            fontSize: Math.max(16, shape.fontSize * scaleX)
          })
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          enabledAnchors={['middle-left', 'middle-right']}
          borderStroke="#7aa2ff"
          anchorStroke="#7aa2ff"
          anchorFill="#0f1115"
          anchorSize={10}
        />
      )}
    </>
  )
}

export default function App() {
  const [count, setCount] = useState(3)
  const [ratioKey, setRatioKey] = useState('4:5')
  const [backgroundMode, setBackgroundMode] = useState('solid')
  const [background, setBackground] = useState('#f7f7f7')
  const [background2, setBackground2] = useState('#dcdcdc')
  const [assets, setAssets] = useState([])
  const [shapes, setShapes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [previewImages, setPreviewImages] = useState([])
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1600)
  const stageRef = useRef(null)
  const wrapRef = useRef(null)

  const ratio = RATIOS[ratioKey]
  const sliceWidth = 1080
  const designWidth = sliceWidth * count
  const designHeight = Math.round(sliceWidth * ratio.h / ratio.w)
  const fitScale = useMemo(() => {
    const availableWidth = Math.max(480, viewportWidth - 700)
    return Math.min(1, availableWidth / designWidth)
  }, [viewportWidth, designWidth])

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setSelectedId(null)
  }, [count, ratioKey])

  const selectedShape = shapes.find(s => s.id === selectedId) || null

  const backgroundProps = backgroundMode === 'solid'
    ? { fill: background }
    : { fillLinearGradientStartPoint: { x: 0, y: 0 }, fillLinearGradientEndPoint: { x: designWidth, y: designHeight }, fillLinearGradientColorStops: [0, background, 1, background2] }

  const updateShape = (next) => {
    setShapes(prev => prev.map(s => s.id === next.id ? next : s))
  }

  const addAssets = (files) => {
    const nextAssets = files.map(file => ({ id: uid(), name: file.name, src: URL.createObjectURL(file) }))
    setAssets(prev => [...nextAssets, ...prev])
  }

  const addImageToCanvas = (asset) => {
    const width = sliceWidth * 0.9
    const height = Math.min(designHeight * 0.72, width * 1.2)
    const shape = {
      id: uid(),
      type: 'image',
      src: asset.src,
      x: Math.max(24, (designWidth - width) / 2),
      y: Math.max(24, (designHeight - height) / 2),
      width,
      height,
      opacity: 1,
      radius: 0,
      shadowBlur: 0,
      strokeWidth: 0,
      stroke: '#ffffff',
      rotation: 0
    }
    setShapes(prev => [...prev, shape])
    setSelectedId(shape.id)
  }

  const addText = () => {
    const shape = {
      id: uid(),
      type: 'text',
      x: 96,
      y: 120,
      width: Math.min(1200, designWidth - 192),
      text: '輸入你的標題',
      fontSize: 96,
      fill: '#111111',
      fontStyle: 'bold',
      align: 'left'
    }
    setShapes(prev => [...prev, shape])
    setSelectedId(shape.id)
  }

  const applyTemplate = (tpl) => {
    const generated = tpl.build(sliceWidth, designHeight, count).map(item => ({ id: uid(), ...item }))
    setShapes(prev => [...prev, ...generated])
  }

  const removeSelected = () => {
    if (!selectedId) return
    setShapes(prev => prev.filter(s => s.id !== selectedId))
    setSelectedId(null)
  }

  const moveLayer = (dir) => {
    if (!selectedId) return
    setShapes(prev => {
      const idx = prev.findIndex(s => s.id === selectedId)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = dir === 'up' ? idx + 1 : idx - 1
      if (swap < 0 || swap >= prev.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  const exportSlices = async (download = false) => {
    const stage = stageRef.current
    if (!stage) return
    const urls = []
    for (let i = 0; i < count; i += 1) {
      const url = stage.toDataURL({
        x: i * sliceWidth,
        y: 0,
        width: sliceWidth,
        height: designHeight,
        pixelRatio: 1
      })
      urls.push(url)
      if (download) {
        const link = document.createElement('a')
        link.href = url
        link.download = `carousel_${String(i + 1).padStart(2, '0')}.png`
        link.click()
        await new Promise(r => setTimeout(r, 80))
      }
    }
    setPreviewImages(urls)
  }

  const exportProject = () => {
    const payload = { count, ratioKey, backgroundMode, background, background2, shapes }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'scrl-lite-project.json'
    link.click()
  }

  const importProject = async (file) => {
    const text = await file.text()
    const payload = JSON.parse(text)
    setCount(payload.count || 3)
    setRatioKey(payload.ratioKey || '4:5')
    setBackgroundMode(payload.backgroundMode || 'solid')
    setBackground(payload.background || '#f7f7f7')
    setBackground2(payload.background2 || '#dcdcdc')
    setShapes(payload.shapes || [])
    setSelectedId(null)
  }

  const handleWheel = (e) => {
    if (!selectedShape || !(e.evt.ctrlKey || e.evt.metaKey)) return
    e.evt.preventDefault()
    const factor = e.evt.deltaY > 0 ? 0.96 : 1.04
    if (selectedShape.type === 'image') {
      updateShape({
        ...selectedShape,
        width: Math.max(40, selectedShape.width * factor),
        height: Math.max(40, selectedShape.height * factor)
      })
    }
    if (selectedShape.type === 'text') {
      updateShape({
        ...selectedShape,
        fontSize: Math.max(14, selectedShape.fontSize * factor),
        width: Math.max(120, selectedShape.width * factor)
      })
    }
  }

  return (
    <div className="shell">
      <aside className="panel left-panel">
        <div className="section">
          <h2>SCRL Lite</h2>
          <p className="muted">React + Konva.js + PWA 版。已補強主畫布預覽、等比縮放與更多模板。</p>
        </div>

        <div className="section">
          <label>輪播張數</label>
          <input type="range" min="2" max="10" value={count} onChange={e => setCount(Number(e.target.value))} />
          <div className="value-row">{count} 張</div>

          <label>比例</label>
          <select value={ratioKey} onChange={e => setRatioKey(e.target.value)}>
            {Object.keys(RATIOS).map(key => <option key={key}>{key}</option>)}
          </select>
        </div>

        <div className="section">
          <div className="toolbar-row">
            <button className="primary" onClick={addText}>新增文字</button>
            <button onClick={removeSelected}>刪除選取</button>
          </div>
          <div className="toolbar-row top8">
            <button onClick={() => moveLayer('down')}>下移圖層</button>
            <button onClick={() => moveLayer('up')}>上移圖層</button>
          </div>
        </div>

        <div className="section">
          <label className="upload-label">
            上傳圖片
            <input type="file" accept="image/*" multiple hidden onChange={e => addAssets(Array.from(e.target.files || []))} />
          </label>
          <div className="assets-grid">
            {assets.map(asset => (
              <button key={asset.id} className="asset-card" onClick={() => addImageToCanvas(asset)} title="加入畫布">
                <img src={asset.src} alt={asset.name} />
                <span>{asset.name}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="workspace">
        <div className="workspace-top">
          <div>
            <strong>主畫布預覽</strong>
            <p className="muted">Ctrl/⌘ + 滑鼠滾輪可對選取物件等比放大縮小。角點拖曳也維持比例。</p>
          </div>
          <div className="toolbar-row compact">
            <button onClick={() => exportSlices(false)}>更新預覽</button>
            <button className="primary" onClick={() => exportSlices(true)}>全部下載</button>
          </div>
        </div>

        <div className="stage-wrap" ref={wrapRef}>
          <div className="stage-inner" style={{ width: designWidth * fitScale, height: designHeight * fitScale }}>
            <Stage
              ref={stageRef}
              width={designWidth}
              height={designHeight}
              scaleX={fitScale}
              scaleY={fitScale}
              onMouseDown={(e) => {
                if (e.target === e.target.getStage()) setSelectedId(null)
              }}
              onTouchStart={(e) => {
                if (e.target === e.target.getStage()) setSelectedId(null)
              }}
              onWheel={handleWheel}
            >
              <Layer>
                <Rect x={0} y={0} width={designWidth} height={designHeight} {...backgroundProps} cornerRadius={32} />
                {shapes.map(shape => {
                  if (shape.type === 'rect') {
                    return (
                      <Rect
                        key={shape.id}
                        x={shape.x}
                        y={shape.y}
                        width={shape.width}
                        height={shape.height}
                        fill={shape.fill || 'transparent'}
                        stroke={shape.stroke || undefined}
                        strokeWidth={shape.strokeWidth || 0}
                        opacity={shape.opacity ?? 1}
                        cornerRadius={shape.radius || 0}
                      />
                    )
                  }
                  if (shape.type === 'text') {
                    return (
                      <CanvasText
                        key={shape.id}
                        shape={shape}
                        isSelected={shape.id === selectedId}
                        onSelect={() => setSelectedId(shape.id)}
                        onChange={updateShape}
                      />
                    )
                  }
                  return (
                    <CanvasImage
                      key={shape.id}
                      shape={shape}
                      isSelected={shape.id === selectedId}
                      onSelect={() => setSelectedId(shape.id)}
                      onChange={updateShape}
                    />
                  )
                })}
                {Array.from({ length: count - 1 }).map((_, i) => (
                  <Line
                    key={i}
                    points={[(i + 1) * sliceWidth, 0, (i + 1) * sliceWidth, designHeight]}
                    stroke="#7aa2ff"
                    strokeWidth={3}
                    dash={[18, 16]}
                  />
                ))}
              </Layer>
            </Stage>
          </div>
        </div>

        <div className="preview-panel">
          <div className="preview-header">
            <strong>切圖預覽</strong>
            <span className="muted">先檢查每張接縫，再手動上傳到 IG。</span>
          </div>
          <div className="preview-grid">
            {previewImages.map((src, idx) => (
              <div className="preview-card" key={src + idx}>
                <img src={src} alt={`slice-${idx + 1}`} />
                <a href={src} download={`carousel_${String(idx + 1).padStart(2, '0')}.png`}>下載 #{idx + 1}</a>
              </div>
            ))}
          </div>
        </div>
      </main>

      <aside className="panel right-panel">
        <div className="section">
          <h3>背景</h3>
          <div className="segmented">
            <button className={backgroundMode === 'solid' ? 'active' : ''} onClick={() => setBackgroundMode('solid')}>純色</button>
            <button className={backgroundMode === 'gradient' ? 'active' : ''} onClick={() => setBackgroundMode('gradient')}>漸層</button>
          </div>
          <label>主色</label>
          <input type="color" value={background} onChange={e => setBackground(e.target.value)} />
          {backgroundMode === 'gradient' && (
            <>
              <label>副色</label>
              <input type="color" value={background2} onChange={e => setBackground2(e.target.value)} />
            </>
          )}
        </div>

        <div className="section">
          <h3>模板</h3>
          <div className="template-list">
            {TEMPLATES.map(tpl => (
              <button key={tpl.id} onClick={() => applyTemplate(tpl)}>{tpl.name}</button>
            ))}
          </div>
        </div>

        <div className="section">
          <h3>選取物件</h3>
          {!selectedShape && <p className="muted">先點選畫布中的圖片或文字。</p>}
          {selectedShape?.type === 'image' && (
            <div className="form-grid">
              <label>圓角<input type="range" min="0" max="120" value={selectedShape.radius || 0} onChange={e => updateShape({ ...selectedShape, radius: Number(e.target.value) })} /></label>
              <label>陰影<input type="range" min="0" max="60" value={selectedShape.shadowBlur || 0} onChange={e => updateShape({ ...selectedShape, shadowBlur: Number(e.target.value) })} /></label>
              <label>透明度<input type="range" min="0.1" max="1" step="0.05" value={selectedShape.opacity ?? 1} onChange={e => updateShape({ ...selectedShape, opacity: Number(e.target.value) })} /></label>
              <label>邊框粗細<input type="range" min="0" max="20" value={selectedShape.strokeWidth || 0} onChange={e => updateShape({ ...selectedShape, strokeWidth: Number(e.target.value) })} /></label>
              <label>邊框顏色<input type="color" value={selectedShape.stroke || '#ffffff'} onChange={e => updateShape({ ...selectedShape, stroke: e.target.value })} /></label>
            </div>
          )}
          {selectedShape?.type === 'text' && (
            <div className="form-grid">
              <label>文字內容<textarea rows="4" value={selectedShape.text} onChange={e => updateShape({ ...selectedShape, text: e.target.value })} /></label>
              <label>字色<input type="color" value={selectedShape.fill} onChange={e => updateShape({ ...selectedShape, fill: e.target.value })} /></label>
              <label>字級<input type="range" min="20" max="180" value={selectedShape.fontSize} onChange={e => updateShape({ ...selectedShape, fontSize: Number(e.target.value) })} /></label>
              <label>對齊<select value={selectedShape.align || 'left'} onChange={e => updateShape({ ...selectedShape, align: e.target.value })}><option value="left">靠左</option><option value="center">置中</option><option value="right">靠右</option></select></label>
            </div>
          )}
        </div>

        <div className="section">
          <h3>專案</h3>
          <div className="toolbar-row">
            <button onClick={exportProject}>匯出 JSON</button>
            <label className="upload-label compact-label">
              匯入 JSON
              <input hidden type="file" accept="application/json" onChange={e => e.target.files?.[0] && importProject(e.target.files[0])} />
            </label>
          </div>
        </div>
      </aside>
    </div>
  )
}
