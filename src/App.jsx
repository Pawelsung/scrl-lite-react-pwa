import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Text,
  Image as KonvaImage,
  Group,
  Line,
  Transformer,
} from "react-konva";

const RATIOS = {
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
  "16:9": { w: 1080, h: 608 },
  "9:16": { w: 1080, h: 1920 },
};

const TEMPLATES = [
  { id: "blank", name: "空白畫布" },
  { id: "magazine", name: "雜誌留白" },
  { id: "cover", name: "大標題封面" },
  { id: "film", name: "底片拼貼" },
  { id: "split", name: "左右文圖" },
  { id: "frame", name: "留白框版型" },
];

const STICKERS = [
  { id: "tape", label: "紙膠帶", type: "tape" },
  { id: "star", label: "星星", type: "star" },
  { id: "circle", label: "圓點", type: "circle" },
];

const SNAP_THRESHOLD = 12;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3;

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgba(hex, alpha = 1) {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((s) => s + s).join("") : raw;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createGradientStops(colorA, colorB) {
  return [0, colorA, 1, colorB];
}

function useImage(src) {
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!src) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = src;
  }, [src]);

  return image;
}

function DraggableImage({
  item,
  isSelected,
  onSelect,
  onChange,
  snapGuides,
  canvasW,
  canvasH,
  transformerAnchorSize = 18,
}) {
  const image = useImage(item.src);
  const shapeRef = useRef(null);
  const trRef = useRef(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const applySnap = (nextX, nextY, width, height) => {
    const centerX = nextX + width / 2;
    const centerY = nextY + height / 2;
    let x = nextX;
    let y = nextY;
    let vertical = null;
    let horizontal = null;

    const xCandidates = [
      { key: "left", value: nextX },
      { key: "center", value: centerX },
      { key: "right", value: nextX + width },
    ];

    const yCandidates = [
      { key: "top", value: nextY },
      { key: "center", value: centerY },
      { key: "bottom", value: nextY + height },
    ];

    for (const guide of snapGuides.vertical) {
      for (const c of xCandidates) {
        if (Math.abs(c.value - guide) <= SNAP_THRESHOLD) {
          if (c.key === "left") x = guide;
          if (c.key === "center") x = guide - width / 2;
          if (c.key === "right") x = guide - width;
          vertical = guide;
        }
      }
    }

    for (const guide of snapGuides.horizontal) {
      for (const c of yCandidates) {
        if (Math.abs(c.value - guide) <= SNAP_THRESHOLD) {
          if (c.key === "top") y = guide;
          if (c.key === "center") y = guide - height / 2;
          if (c.key === "bottom") y = guide - height;
          horizontal = guide;
        }
      }
    }

    x = clamp(x, 0, Math.max(0, canvasW - width));
    y = clamp(y, 0, Math.max(0, canvasH - height));

    return { x, y, vertical, horizontal };
  };

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image}
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        rotation={item.rotation || 0}
        opacity={item.opacity ?? 1}
        cornerRadius={item.radius || 0}
        shadowBlur={item.shadow || 0}
        shadowOpacity={item.shadow ? 0.28 : 0}
        shadowOffsetY={item.shadow ? 8 : 0}
        stroke={item.borderWidth ? item.borderColor || "#ffffff" : undefined}
        strokeWidth={item.borderWidth || 0}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={(e) => {
          const node = e.target;
          const snapped = applySnap(node.x(), node.y(), item.width, item.height);
          node.position({ x: snapped.x, y: snapped.y });
          onChange({
            ...item,
            x: snapped.x,
            y: snapped.y,
            snapV: snapped.vertical,
            snapH: snapped.horizontal,
          });
        }}
        onDragEnd={(e) => {
          const node = e.target;
          onChange({
            ...item,
            x: node.x(),
            y: node.y(),
            snapV: null,
            snapH: null,
          });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          const next = {
            ...item,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            width: Math.max(40, node.width() * scaleX),
            height: Math.max(40, node.height() * scaleY),
          };

          node.scaleX(1);
          node.scaleY(1);
          onChange(next);
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio
          anchorSize={transformerAnchorSize}
          borderStroke="#78a7ff"
          anchorStroke="#78a7ff"
          anchorFill="#0b0f17"
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 40 || newBox.height < 40) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
}

function DraggableText({
  item,
  isSelected,
  onSelect,
  onChange,
  snapGuides,
  canvasW,
  canvasH,
  transformerAnchorSize = 18,
}) {
  const textRef = useRef(null);
  const trRef = useRef(null);

  useEffect(() => {
    if (isSelected && trRef.current && textRef.current) {
      trRef.current.nodes([textRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const width = item.width || 400;
  const height = item.fontSize * 1.6;

  const applySnap = (nextX, nextY) => {
    const centerX = nextX + width / 2;
    const centerY = nextY + height / 2;
    let x = nextX;
    let y = nextY;
    let vertical = null;
    let horizontal = null;

    const xCandidates = [
      { key: "left", value: nextX },
      { key: "center", value: centerX },
      { key: "right", value: nextX + width },
    ];
    const yCandidates = [
      { key: "top", value: nextY },
      { key: "center", value: centerY },
      { key: "bottom", value: nextY + height },
    ];

    for (const guide of snapGuides.vertical) {
      for (const c of xCandidates) {
        if (Math.abs(c.value - guide) <= SNAP_THRESHOLD) {
          if (c.key === "left") x = guide;
          if (c.key === "center") x = guide - width / 2;
          if (c.key === "right") x = guide - width;
          vertical = guide;
        }
      }
    }

    for (const guide of snapGuides.horizontal) {
      for (const c of yCandidates) {
        if (Math.abs(c.value - guide) <= SNAP_THRESHOLD) {
          if (c.key === "top") y = guide;
          if (c.key === "center") y = guide - height / 2;
          if (c.key === "bottom") y = guide - height;
          horizontal = guide;
        }
      }
    }

    x = clamp(x, 0, Math.max(0, canvasW - width));
    y = clamp(y, 0, Math.max(0, canvasH - height));

    return { x, y, vertical, horizontal };
  };

  return (
    <>
      <Text
        ref={textRef}
        x={item.x}
        y={item.y}
        text={item.text}
        width={item.width || 400}
        fontSize={item.fontSize}
        fontStyle={item.fontStyle || "normal"}
        fontFamily={item.fontFamily || "Inter, system-ui, sans-serif"}
        fill={item.fill || "#111111"}
        align={item.align || "left"}
        opacity={item.opacity ?? 1}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={(e) => {
          const node = e.target;
          const snapped = applySnap(node.x(), node.y());
          node.position({ x: snapped.x, y: snapped.y });
          onChange({
            ...item,
            x: snapped.x,
            y: snapped.y,
            snapV: snapped.vertical,
            snapH: snapped.horizontal,
          });
        }}
        onDragEnd={(e) => {
          const node = e.target;
          onChange({ ...item, x: node.x(), y: node.y(), snapV: null, snapH: null });
        }}
        onTransformEnd={() => {
          const node = textRef.current;
          const scaleX = node.scaleX();
          const nextWidth = Math.max(120, (item.width || 400) * scaleX);

          node.scaleX(1);
          node.scaleY(1);

          onChange({
            ...item,
            x: node.x(),
            y: node.y(),
            width: nextWidth,
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          anchorSize={transformerAnchorSize}
          borderStroke="#78a7ff"
          anchorStroke="#78a7ff"
          anchorFill="#0b0f17"
          enabledAnchors={["middle-left", "middle-right"]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 120) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
}

function StickerShape({
  item,
  isSelected,
  onSelect,
  onChange,
  snapGuides,
  canvasW,
  canvasH,
  transformerAnchorSize = 18,
}) {
  const groupRef = useRef(null);
  const trRef = useRef(null);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const width = item.width;
  const height = item.height;

  const applySnap = (nextX, nextY) => {
    const centerX = nextX + width / 2;
    const centerY = nextY + height / 2;
    let x = nextX;
    let y = nextY;
    let vertical = null;
    let horizontal = null;

    const xCandidates = [
      { key: "left", value: nextX },
      { key: "center", value: centerX },
      { key: "right", value: nextX + width },
    ];
    const yCandidates = [
      { key: "top", value: nextY },
      { key: "center", value: centerY },
      { key: "bottom", value: nextY + height },
    ];

    for (const guide of snapGuides.vertical) {
      for (const c of xCandidates) {
        if (Math.abs(c.value - guide) <= SNAP_THRESHOLD) {
          if (c.key === "left") x = guide;
          if (c.key === "center") x = guide - width / 2;
          if (c.key === "right") x = guide - width;
          vertical = guide;
        }
      }
    }

    for (const guide of snapGuides.horizontal) {
      for (const c of yCandidates) {
        if (Math.abs(c.value - guide) <= SNAP_THRESHOLD) {
          if (c.key === "top") y = guide;
          if (c.key === "center") y = guide - height / 2;
          if (c.key === "bottom") y = guide - height;
          horizontal = guide;
        }
      }
    }

    x = clamp(x, 0, Math.max(0, canvasW - width));
    y = clamp(y, 0, Math.max(0, canvasH - height));

    return { x, y, vertical, horizontal };
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={item.x}
        y={item.y}
        rotation={item.rotation || 0}
        opacity={item.opacity ?? 1}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={(e) => {
          const node = e.target;
          const snapped = applySnap(node.x(), node.y());
          node.position({ x: snapped.x, y: snapped.y });
          onChange({
            ...item,
            x: snapped.x,
            y: snapped.y,
            snapV: snapped.vertical,
            snapH: snapped.horizontal,
          });
        }}
        onDragEnd={(e) => {
          const node = e.target;
          onChange({ ...item, x: node.x(), y: node.y(), snapV: null, snapH: null });
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          const next = {
            ...item,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            width: Math.max(30, item.width * node.scaleX()),
            height: Math.max(30, item.height * node.scaleY()),
          };
          node.scaleX(1);
          node.scaleY(1);
          onChange(next);
        }}
      >
        {item.stickerType === "tape" && (
          <Rect
            width={item.width}
            height={item.height}
            cornerRadius={10}
            fill={hexToRgba(item.fill || "#f8df8f", 0.55)}
            stroke={hexToRgba("#ffffff", 0.25)}
            strokeWidth={1}
          />
        )}
        {item.stickerType === "circle" && (
          <Rect
            width={item.width}
            height={item.height}
            cornerRadius={999}
            fill={item.fill || "#ffffff"}
          />
        )}
        {item.stickerType === "star" && (
          <Line
            points={[
              item.width * 0.5, 0,
              item.width * 0.62, item.height * 0.34,
              item.width, item.height * 0.38,
              item.width * 0.7, item.height * 0.62,
              item.width * 0.82, item.height,
              item.width * 0.5, item.height * 0.78,
              item.width * 0.18, item.height,
              item.width * 0.3, item.height * 0.62,
              0, item.height * 0.38,
              item.width * 0.38, item.height * 0.34,
            ]}
            closed
            fill={item.fill || "#ffeb79"}
            stroke={hexToRgba("#ffffff", 0.35)}
            strokeWidth={1}
          />
        )}
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio
          anchorSize={transformerAnchorSize}
          borderStroke="#78a7ff"
          anchorStroke="#78a7ff"
          anchorFill="#0b0f17"
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
        />
      )}
    </>
  );
}

export default function App() {
  const [slides, setSlides] = useState(3);
  const [ratioKey, setRatioKey] = useState("4:5");
  const [backgroundMode, setBackgroundMode] = useState("solid");
  const [bgPrimary, setBgPrimary] = useState("#f5f5f5");
  const [bgSecondary, setBgSecondary] = useState("#e5e7eb");
  const [images, setImages] = useState([]);
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [containerSize, setContainerSize] = useState({ w: 1200, h: 700 });
  const [templateId, setTemplateId] = useState("blank");
  const [showGuides, setShowGuides] = useState(true);

  const [userZoom, setUserZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const fileRef = useRef(null);
  const importRef = useRef(null);

  const gestureRef = useRef({
    isPanning: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    pinchStartDistance: 0,
    pinchStartZoom: 1,
    pinchStartPan: { x: 0, y: 0 },
    pinchCenter: { x: 0, y: 0 },
  });

  const singleW = RATIOS[ratioKey].w;
  const singleH = RATIOS[ratioKey].h;
  const canvasW = singleW * slides;
  const canvasH = singleH;

  const selectedItem = elements.find((el) => el.id === selectedId) || null;

  useEffect(() => {
    const onResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setContainerSize({ w: rect.width, h: rect.height });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const fitScale = useMemo(() => {
    const pad = 32;
    const usableW = Math.max(320, containerSize.w - pad);
    const usableH = Math.max(260, containerSize.h - pad);
    return Math.min(usableW / canvasW, usableH / canvasH, 1);
  }, [containerSize, canvasW, canvasH]);

  const displayScale = fitScale * userZoom;

  const clampPan = (nextX, nextY, zoom = userZoom) => {
    const scaledW = canvasW * fitScale * zoom;
    const scaledH = canvasH * fitScale * zoom;

    const viewportW = containerSize.w;
    const viewportH = containerSize.h;

    const minX = Math.min(0, viewportW - scaledW - 24);
    const minY = Math.min(0, viewportH - scaledH - 24);
    const maxX = 0;
    const maxY = 0;

    return {
      x: clamp(nextX, minX, maxX),
      y: clamp(nextY, minY, maxY),
    };
  };

  useEffect(() => {
    setPan((prev) => clampPan(prev.x, prev.y, userZoom));
  }, [fitScale, containerSize.w, containerSize.h]); // eslint-disable-line

  const resetView = () => {
    setUserZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const setZoomAroundCenter = (nextZoom) => {
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const viewportCenterX = containerSize.w / 2;
    const viewportCenterY = containerSize.h / 2;

    const oldScale = fitScale * userZoom;
    const newScale = fitScale * zoom;

    const contentX = (viewportCenterX - pan.x) / oldScale;
    const contentY = (viewportCenterY - pan.y) / oldScale;

    let nextPanX = viewportCenterX - contentX * newScale;
    let nextPanY = viewportCenterY - contentY * newScale;

    const clamped = clampPan(nextPanX, nextPanY, zoom);
    setUserZoom(zoom);
    setPan(clamped);
  };

  const zoomIn = () => setZoomAroundCenter(userZoom * 1.2);
  const zoomOut = () => setZoomAroundCenter(userZoom / 1.2);
  const zoom100 = () => {
    const zoom = clamp(1 / fitScale, MIN_ZOOM, MAX_ZOOM);
    setZoomAroundCenter(zoom);
  };
  const fitToScreen = () => resetView();

  const snapGuides = useMemo(() => {
    const vertical = [0, canvasW / 2, canvasW];
    const horizontal = [0, canvasH / 2, canvasH];

    for (let i = 0; i <= slides; i++) {
      vertical.push(i * singleW);
    }

    return { vertical, horizontal };
  }, [canvasW, canvasH, slides, singleW]);

  const activeGuides = useMemo(() => {
    if (!selectedItem) return { vertical: [], horizontal: [] };
    return {
      vertical: selectedItem.snapV != null ? [selectedItem.snapV] : [],
      horizontal: selectedItem.snapH != null ? [selectedItem.snapH] : [],
    };
  }, [selectedItem]);

  const updateElement = (next) => {
    setElements((prev) => prev.map((el) => (el.id === next.id ? next : el)));
  };

  const addImageToCanvas = (img) => {
    const maxH = canvasH * 0.72;
    const ratio = img.width / img.height || 1;
    const targetH = maxH;
    const targetW = targetH * ratio;

    const item = {
      id: uid("img"),
      type: "image",
      src: img.src,
      x: Math.max(20, canvasW / 2 - targetW / 2),
      y: Math.max(20, canvasH / 2 - targetH / 2),
      width: targetW,
      height: targetH,
      rotation: 0,
      opacity: 1,
      radius: 0,
      shadow: 0,
      borderWidth: 0,
      borderColor: "#ffffff",
    };
    setElements((prev) => [...prev, item]);
    setSelectedId(item.id);
  };

  const onUploadFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    const next = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const img = new window.Image();
              img.onload = () => {
                resolve({
                  id: uid("asset"),
                  name: file.name,
                  src: reader.result,
                  width: img.width,
                  height: img.height,
                });
              };
              img.src = reader.result;
            };
            reader.readAsDataURL(file);
          })
      )
    );
    setImages((prev) => [...next, ...prev]);
    e.target.value = "";
  };

  const addText = () => {
    const item = {
      id: uid("text"),
      type: "text",
      text: "Your Story",
      x: 80,
      y: 80,
      width: 420,
      fontSize: 64,
      fontStyle: "bold",
      fill: "#111111",
      align: "left",
      opacity: 1,
    };
    setElements((prev) => [...prev, item]);
    setSelectedId(item.id);
  };

  const addSticker = (type) => {
    const base = {
      id: uid("sticker"),
      type: "sticker",
      stickerType: type,
      x: 120,
      y: 120,
      rotation: type === "tape" ? -8 : 0,
      opacity: 1,
      fill: type === "star" ? "#ffea73" : type === "circle" ? "#ffffff" : "#ead788",
    };

    let item = base;
    if (type === "tape") item = { ...base, width: 180, height: 54 };
    if (type === "circle") item = { ...base, width: 90, height: 90 };
    if (type === "star") item = { ...base, width: 110, height: 110 };

    setElements((prev) => [...prev, item]);
    setSelectedId(item.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  const bringForward = () => {
    if (!selectedId) return;
    setElements((prev) => {
      const idx = prev.findIndex((el) => el.id === selectedId);
      if (idx < 0 || idx === prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  };

  const sendBackward = () => {
    if (!selectedId) return;
    setElements((prev) => {
      const idx = prev.findIndex((el) => el.id === selectedId);
      if (idx <= 0) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
      return arr;
    });
  };

  const applyTemplate = (id) => {
    setTemplateId(id);
    const next = [];

    if (id === "blank") {
      setElements([]);
      setSelectedId(null);
      return;
    }

    if (id === "magazine") {
      next.push({
        id: uid("text"),
        type: "text",
        text: "Your Story",
        x: 80,
        y: 60,
        width: 520,
        fontSize: 64,
        fontStyle: "bold",
        fill: "#111111",
        align: "left",
        opacity: 1,
      });
      next.push({
        id: uid("sticker"),
        type: "sticker",
        stickerType: "tape",
        x: singleW * 0.6,
        y: 72,
        width: 160,
        height: 46,
        rotation: -7,
        opacity: 1,
        fill: "#ead788",
      });
    }

    if (id === "cover") {
      next.push({
        id: uid("text"),
        type: "text",
        text: "A Quiet\nCarousel Story",
        x: 100,
        y: canvasH * 0.15,
        width: singleW * 1.4,
        fontSize: 92,
        fontStyle: "bold",
        fill: "#111111",
        align: "left",
        opacity: 1,
      });
      next.push({
        id: uid("text"),
        type: "text",
        text: "Minimal layout · seamless slices",
        x: 108,
        y: canvasH * 0.52,
        width: 720,
        fontSize: 34,
        fontStyle: "normal",
        fill: "#444444",
        align: "left",
        opacity: 0.88,
      });
    }

    if (id === "film") {
      for (let i = 0; i < slides; i++) {
        next.push({
          id: uid("frame"),
          type: "frameRect",
          x: i * singleW + 70,
          y: 70,
          width: singleW - 140,
          height: canvasH - 140,
          fill: "rgba(255,255,255,0)",
          stroke: "#111111",
          strokeWidth: 22,
          radius: 22,
        });
      }
      next.push({
        id: uid("text"),
        type: "text",
        text: "Film Diary",
        x: 100,
        y: 92,
        width: 380,
        fontSize: 40,
        fontStyle: "bold",
        fill: "#111111",
        align: "left",
        opacity: 1,
      });
    }

    if (id === "split") {
      next.push({
        id: uid("text"),
        type: "text",
        text: "Moodboard",
        x: 100,
        y: canvasH * 0.2,
        width: 420,
        fontSize: 84,
        fontStyle: "bold",
        fill: "#111111",
        align: "left",
        opacity: 1,
      });
      next.push({
        id: uid("text"),
        type: "text",
        text: "Left text, right image.\nSimple and clean.",
        x: 100,
        y: canvasH * 0.42,
        width: 440,
        fontSize: 32,
        fontStyle: "normal",
        fill: "#444444",
        align: "left",
        opacity: 1,
      });
    }

    if (id === "frame") {
      next.push({
        id: uid("frame"),
        type: "frameRect",
        x: 70,
        y: 70,
        width: canvasW - 140,
        height: canvasH - 140,
        fill: "rgba(255,255,255,0)",
        stroke: "#ffffff",
        strokeWidth: 26,
        radius: 32,
      });
      next.push({
        id: uid("text"),
        type: "text",
        text: "Framed Layout",
        x: 100,
        y: 94,
        width: 420,
        fontSize: 44,
        fontStyle: "bold",
        fill: "#111111",
        align: "left",
        opacity: 1,
      });
    }

    setElements(next);
    setSelectedId(null);
  };

  const exportSlices = () => {
    const stage = stageRef.current;
    if (!stage) return [];

    const list = [];
    for (let i = 0; i < slides; i++) {
      const dataUrl = stage.toDataURL({
        x: i * singleW,
        y: 0,
        width: singleW,
        height: singleH,
        pixelRatio: 1,
      });
      list.push(dataUrl);
    }
    return list;
  };

  const refreshPreviews = () => {
    const data = exportSlices();
    setPreviews(data);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshPreviews();
    }, 80);
    return () => clearTimeout(timer);
  }, [elements, slides, ratioKey, bgPrimary, bgSecondary, backgroundMode]);

  const downloadDataUrl = (dataUrl, filename) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const downloadAll = () => {
    const data = exportSlices();
    data.forEach((src, idx) => {
      setTimeout(() => {
        downloadDataUrl(src, `carousel_${String(idx + 1).padStart(2, "0")}.png`);
      }, idx * 140);
    });
  };

  const exportProject = () => {
    const data = {
      slides,
      ratioKey,
      backgroundMode,
      bgPrimary,
      bgSecondary,
      images,
      elements,
      templateId,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, "scrl-lite-project.json");
    URL.revokeObjectURL(url);
  };

  const importProject = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setSlides(data.slides || 3);
        setRatioKey(data.ratioKey || "4:5");
        setBackgroundMode(data.backgroundMode || "solid");
        setBgPrimary(data.bgPrimary || "#f5f5f5");
        setBgSecondary(data.bgSecondary || "#e5e7eb");
        setImages(data.images || []);
        setElements(data.elements || []);
        setTemplateId(data.templateId || "blank");
        setSelectedId(null);
      } catch (err) {
        alert("JSON 專案檔讀取失敗");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        const editable = activeTag === "input" || activeTag === "textarea";
        if (!editable && selectedId) removeSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (!selectedItem) return;
        const clone = {
          ...selectedItem,
          id: uid(selectedItem.type),
          x: selectedItem.x + 32,
          y: selectedItem.y + 32,
        };
        setElements((prev) => [...prev, clone]);
        setSelectedId(clone.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, selectedItem]);

  const onWheelScaleSelected = (e) => {
    if (!(e.evt.ctrlKey || e.evt.metaKey)) return;
    if (!selectedItem) return;
    e.evt.preventDefault();

    const delta = e.evt.deltaY;
    const factor = delta > 0 ? 0.96 : 1.04;

    if (selectedItem.type === "image" || selectedItem.type === "sticker") {
      updateElement({
        ...selectedItem,
        width: Math.max(40, selectedItem.width * factor),
        height: Math.max(40, selectedItem.height * factor),
      });
    }

    if (selectedItem.type === "text") {
      updateElement({
        ...selectedItem,
        fontSize: Math.max(12, selectedItem.fontSize * factor),
      });
    }
  };

  const renderBackground = () => {
    if (backgroundMode === "solid") {
      return (
        <Rect
          x={0}
          y={0}
          width={canvasW}
          height={canvasH}
          fill={bgPrimary}
          cornerRadius={40}
        />
      );
    }

    return (
      <Rect
        x={0}
        y={0}
        width={canvasW}
        height={canvasH}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: canvasW, y: canvasH }}
        fillLinearGradientColorStops={createGradientStops(bgPrimary, bgSecondary)}
        cornerRadius={40}
      />
    );
  };

  const frameRects = elements.filter((el) => el.type === "frameRect");
  const drawable = elements.filter((el) => el.type !== "frameRect");

  const getDistance = (touches) => {
    const [a, b] = touches;
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getMidpoint = (touches) => {
    const [a, b] = touches;
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
    };
  };

  const handleViewportPointerDown = (e) => {
    if (e.target.closest(".canvas-zoom-toolbar")) return;
    gestureRef.current.isPanning = true;
    gestureRef.current.startX = e.clientX;
    gestureRef.current.startY = e.clientY;
    gestureRef.current.startPanX = pan.x;
    gestureRef.current.startPanY = pan.y;
  };

  const handleViewportPointerMove = (e) => {
    if (!gestureRef.current.isPanning) return;
    const dx = e.clientX - gestureRef.current.startX;
    const dy = e.clientY - gestureRef.current.startY;
    const next = clampPan(
      gestureRef.current.startPanX + dx,
      gestureRef.current.startPanY + dy,
      userZoom
    );
    setPan(next);
  };

  const handleViewportPointerUp = () => {
    gestureRef.current.isPanning = false;
  };

  const handleViewportTouchStart = (e) => {
    if (e.touches.length === 2) {
      const distance = getDistance(e.touches);
      const midpoint = getMidpoint(e.touches);
      gestureRef.current.pinchStartDistance = distance;
      gestureRef.current.pinchStartZoom = userZoom;
      gestureRef.current.pinchStartPan = { ...pan };
      gestureRef.current.pinchCenter = midpoint;
      gestureRef.current.isPanning = false;
    } else if (e.touches.length === 1) {
      gestureRef.current.isPanning = true;
      gestureRef.current.startX = e.touches[0].clientX;
      gestureRef.current.startY = e.touches[0].clientY;
      gestureRef.current.startPanX = pan.x;
      gestureRef.current.startPanY = pan.y;
    }
  };

  const handleViewportTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getDistance(e.touches);
      const midpoint = getMidpoint(e.touches);
      const ratio = distance / gestureRef.current.pinchStartDistance;
      const nextZoom = clamp(
        gestureRef.current.pinchStartZoom * ratio,
        MIN_ZOOM,
        MAX_ZOOM
      );

      const oldScale = fitScale * gestureRef.current.pinchStartZoom;
      const newScale = fitScale * nextZoom;

      const contentX =
        (gestureRef.current.pinchCenter.x - gestureRef.current.pinchStartPan.x) /
        oldScale;
      const contentY =
        (gestureRef.current.pinchCenter.y - gestureRef.current.pinchStartPan.y) /
        oldScale;

      let nextPanX = midpoint.x - contentX * newScale;
      let nextPanY = midpoint.y - contentY * newScale;

      const clamped = clampPan(nextPanX, nextPanY, nextZoom);
      setUserZoom(nextZoom);
      setPan(clamped);
      return;
    }

    if (e.touches.length === 1 && gestureRef.current.isPanning) {
      e.preventDefault();
      const dx = e.touches[0].clientX - gestureRef.current.startX;
      const dy = e.touches[0].clientY - gestureRef.current.startY;
      const next = clampPan(
        gestureRef.current.startPanX + dx,
        gestureRef.current.startPanY + dy,
        userZoom
      );
      setPan(next);
    }
  };

  const handleViewportTouchEnd = () => {
    gestureRef.current.isPanning = false;
  };

  const transformerAnchorSize = useMemo(() => {
    if (window.innerWidth < 768) return 26;
    return 18;
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar left">
        <div className="panel">
          <h2>專案</h2>
          <label className="field">
            <span>輪播張數</span>
            <input
              type="range"
              min="2"
              max="10"
              value={slides}
              onChange={(e) => setSlides(Number(e.target.value))}
            />
            <strong>{slides} 張</strong>
          </label>

          <label className="field">
            <span>比例</span>
            <select value={ratioKey} onChange={(e) => setRatioKey(e.target.value)}>
              {Object.keys(RATIOS).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>

          <div className="button-row">
            <button onClick={() => fileRef.current?.click()}>上傳圖片</button>
            <button className="ghost" onClick={addText}>
              新增文字
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onUploadFiles}
          />

          <div className="button-row">
            <button className="ghost" onClick={exportProject}>
              匯出 JSON
            </button>
            <button className="ghost" onClick={() => importRef.current?.click()}>
              匯入 JSON
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            hidden
            onChange={importProject}
          />
        </div>

        <div className="panel">
          <h2>素材</h2>
          <div className="asset-grid">
            {images.length === 0 && (
              <div className="hint-card">先上傳圖片，再點縮圖加入畫布。</div>
            )}
            {images.map((img) => (
              <button
                key={img.id}
                className="asset-btn"
                onClick={() => addImageToCanvas(img)}
                title={img.name}
              >
                <img src={img.src} alt={img.name} />
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>貼紙</h2>
          <div className="template-grid compact">
            {STICKERS.map((st) => (
              <button key={st.id} className="template-btn" onClick={() => addSticker(st.type)}>
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="canvas-panel">
          <div className="canvas-toolbar">
            <div>
              <strong>SCRL Lite</strong>
              <span className="sub"> 手機可雙指縮放整個畫布</span>
            </div>
            <div className="toolbar-actions">
              <button className="ghost" onClick={sendBackward}>
                下移一層
              </button>
              <button className="ghost" onClick={bringForward}>
                上移一層
              </button>
              <button className="ghost danger" onClick={removeSelected}>
                刪除選取
              </button>
              <button onClick={refreshPreviews}>更新預覽</button>
            </div>
          </div>

          <div
            ref={containerRef}
            className="canvas-stage-wrap"
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerUp}
            onPointerCancel={handleViewportPointerUp}
            onTouchStart={handleViewportTouchStart}
            onTouchMove={handleViewportTouchMove}
            onTouchEnd={handleViewportTouchEnd}
            onTouchCancel={handleViewportTouchEnd}
            onDoubleClick={resetView}
          >
            <div className="canvas-zoom-toolbar">
              <button onClick={zoomOut}>－</button>
              <button onClick={zoomIn}>＋</button>
              <button onClick={fitToScreen}>Fit</button>
              <button onClick={zoom100}>100%</button>
              <div className="zoom-readout">{Math.round(displayScale * 100)}%</div>
            </div>

            <div
              className="stage-pan-layer"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px)`,
              }}
            >
              <div
                className="stage-scale-box"
                style={{
                  width: canvasW * displayScale,
                  height: canvasH * displayScale,
                }}
              >
                <div
                  className="stage-real-size"
                  style={{
                    width: canvasW,
                    height: canvasH,
                    transform: `scale(${displayScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <Stage
                    ref={stageRef}
                    width={canvasW}
                    height={canvasH}
                    onMouseDown={(e) => {
                      const clickedOnEmpty = e.target === e.target.getStage();
                      if (clickedOnEmpty) setSelectedId(null);
                    }}
                    onTouchStart={(e) => {
                      const clickedOnEmpty = e.target === e.target.getStage();
                      if (clickedOnEmpty) setSelectedId(null);
                    }}
                    onWheel={onWheelScaleSelected}
                  >
                    <Layer>
                      {renderBackground()}

                      {frameRects.map((frame) => (
                        <Rect
                          key={frame.id}
                          x={frame.x}
                          y={frame.y}
                          width={frame.width}
                          height={frame.height}
                          fill={frame.fill}
                          stroke={frame.stroke}
                          strokeWidth={frame.strokeWidth}
                          cornerRadius={frame.radius}
                        />
                      ))}

                      {showGuides &&
                        Array.from({ length: slides - 1 }).map((_, i) => (
                          <Line
                            key={`slice-${i}`}
                            points={[(i + 1) * singleW, 0, (i + 1) * singleW, canvasH]}
                            stroke={hexToRgba("#6ba4ff", 0.85)}
                            dash={[18, 14]}
                            strokeWidth={3}
                          />
                        ))}

                      {showGuides && (
                        <>
                          {activeGuides.vertical.map((x, idx) => (
                            <Line
                              key={`gv-${idx}`}
                              points={[x, 0, x, canvasH]}
                              stroke={hexToRgba("#35f2a1", 0.9)}
                              dash={[10, 8]}
                              strokeWidth={2}
                            />
                          ))}
                          {activeGuides.horizontal.map((y, idx) => (
                            <Line
                              key={`gh-${idx}`}
                              points={[0, y, canvasW, y]}
                              stroke={hexToRgba("#35f2a1", 0.9)}
                              dash={[10, 8]}
                              strokeWidth={2}
                            />
                          ))}
                        </>
                      )}

                      {drawable.map((item) => {
                        if (item.type === "image") {
                          return (
                            <DraggableImage
                              key={item.id}
                              item={item}
                              isSelected={item.id === selectedId}
                              onSelect={() => setSelectedId(item.id)}
                              onChange={updateElement}
                              snapGuides={snapGuides}
                              canvasW={canvasW}
                              canvasH={canvasH}
                              transformerAnchorSize={transformerAnchorSize}
                            />
                          );
                        }

                        if (item.type === "text") {
                          return (
                            <DraggableText
                              key={item.id}
                              item={item}
                              isSelected={item.id === selectedId}
                              onSelect={() => setSelectedId(item.id)}
                              onChange={updateElement}
                              snapGuides={snapGuides}
                              canvasW={canvasW}
                              canvasH={canvasH}
                              transformerAnchorSize={transformerAnchorSize}
                            />
                          );
                        }

                        if (item.type === "sticker") {
                          return (
                            <StickerShape
                              key={item.id}
                              item={item}
                              isSelected={item.id === selectedId}
                              onSelect={() => setSelectedId(item.id)}
                              onChange={updateElement}
                              snapGuides={snapGuides}
                              canvasW={canvasW}
                              canvasH={canvasH}
                              transformerAnchorSize={transformerAnchorSize}
                            />
                          );
                        }

                        return null;
                      })}
                    </Layer>
                  </Stage>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="preview-panel">
          <div className="preview-head">
            <h2>切圖預覽</h2>
            <p>先檢查每張接縫，再手動上傳到 IG。</p>
          </div>
          <div className="preview-grid">
            {previews.map((src, idx) => (
              <div key={idx} className="preview-card">
                <img src={src} alt={`preview-${idx + 1}`} />
                <button
                  onClick={() =>
                    downloadDataUrl(
                      src,
                      `carousel_${String(idx + 1).padStart(2, "0")}.png`
                    )
                  }
                >
                  下載 #{idx + 1}
                </button>
              </div>
            ))}
          </div>
          <div className="download-all-row">
            <button onClick={downloadAll}>全部下載</button>
          </div>
        </div>
      </main>

      <aside className="sidebar right">
        <div className="panel">
          <h2>背景</h2>
          <label className="field">
            <span>模式</span>
            <select value={backgroundMode} onChange={(e) => setBackgroundMode(e.target.value)}>
              <option value="solid">純色</option>
              <option value="gradient">漸層</option>
            </select>
          </label>

          <div className="color-row">
            <label>
              主色
              <input type="color" value={bgPrimary} onChange={(e) => setBgPrimary(e.target.value)} />
            </label>
            <label>
              副色
              <input type="color" value={bgSecondary} onChange={(e) => setBgSecondary(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="panel">
          <h2>模板</h2>
          <div className="template-grid">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                className={`template-btn ${templateId === t.id ? "active" : ""}`}
                onClick={() => applyTemplate(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>選取物件</h2>
          {!selectedItem && <div className="hint-card">點一下畫布中的圖片、文字或貼紙。</div>}

          {selectedItem?.type === "image" && (
            <>
              <label className="field">
                <span>圓角</span>
                <input
                  type="range"
                  min="0"
                  max="120"
                  value={selectedItem.radius || 0}
                  onChange={(e) => updateElement({ ...selectedItem, radius: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>陰影</span>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={selectedItem.shadow || 0}
                  onChange={(e) => updateElement({ ...selectedItem, shadow: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>透明度</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.01"
                  value={selectedItem.opacity ?? 1}
                  onChange={(e) => updateElement({ ...selectedItem, opacity: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>邊框粗細</span>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={selectedItem.borderWidth || 0}
                  onChange={(e) => updateElement({ ...selectedItem, borderWidth: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>邊框顏色</span>
                <input
                  type="color"
                  value={selectedItem.borderColor || "#ffffff"}
                  onChange={(e) => updateElement({ ...selectedItem, borderColor: e.target.value })}
                />
              </label>
            </>
          )}

          {selectedItem?.type === "text" && (
            <>
              <label className="field">
                <span>文字內容</span>
                <textarea
                  rows="4"
                  value={selectedItem.text}
                  onChange={(e) => updateElement({ ...selectedItem, text: e.target.value })}
                />
              </label>
              <label className="field">
                <span>字體大小</span>
                <input
                  type="range"
                  min="16"
                  max="180"
                  value={selectedItem.fontSize}
                  onChange={(e) => updateElement({ ...selectedItem, fontSize: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>顏色</span>
                <input
                  type="color"
                  value={selectedItem.fill || "#111111"}
                  onChange={(e) => updateElement({ ...selectedItem, fill: e.target.value })}
                />
              </label>
              <label className="field">
                <span>字重</span>
                <select
                  value={selectedItem.fontStyle || "normal"}
                  onChange={(e) => updateElement({ ...selectedItem, fontStyle: e.target.value })}
                >
                  <option value="normal">normal</option>
                  <option value="bold">bold</option>
                  <option value="italic">italic</option>
                </select>
              </label>
              <label className="field">
                <span>對齊</span>
                <select
                  value={selectedItem.align || "left"}
                  onChange={(e) => updateElement({ ...selectedItem, align: e.target.value })}
                >
                  <option value="left">left</option>
                  <option value="center">center</option>
                  <option value="right">right</option>
                </select>
              </label>
            </>
          )}

          {selectedItem?.type === "sticker" && (
            <>
              <label className="field">
                <span>顏色</span>
                <input
                  type="color"
                  value={selectedItem.fill || "#ffffff"}
                  onChange={(e) => updateElement({ ...selectedItem, fill: e.target.value })}
                />
              </label>
              <label className="field">
                <span>透明度</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.01"
                  value={selectedItem.opacity ?? 1}
                  onChange={(e) => updateElement({ ...selectedItem, opacity: Number(e.target.value) })}
                />
              </label>
            </>
          )}

          <div className="button-row">
            <button className="ghost" onClick={() => setShowGuides((v) => !v)}>
              {showGuides ? "隱藏參考線" : "顯示參考線"}
            </button>
          </div>

          <div className="hint-card">
            <strong>手機操作</strong>
            <br />
            雙指：縮放整個畫布
            <br />
            單指：平移畫布
            <br />
            雙擊：重設視圖
            <br />
            Ctrl / ⌘ + 滾輪：等比縮放選取物件
          </div>
        </div>
      </aside>
    </div>
  );
}