const zhTW = {
    // Index page
    'index.title': 'uē-tôo 範例',
    'index.subtitle': '互動式範例與 demo ',
    'index.description': '探索以下各種功能與整合範例。',

    // Nav links
    'nav.base': '基本',
    'nav.attach-detach': '掛載 / 卸載',
    'nav.ruler': '尺規',
    'nav.navigation': '導覽',
    'nav.pixi': 'Pixi 整合',
    'nav.konva': 'Konva 整合',
    'nav.fabric': 'Fabric 整合',
    'nav.camera-animation': '鏡頭動畫',
    'nav.image': '圖片範例',
    'nav.svg': 'SVG 範例',
    'nav.pele-mermaid': 'Mermaid（Pele）',
    'nav.state-machine': '狀態機視覺化',

    // Card titles & descriptions
    'card.base.title': '基本範例',
    'card.base.desc':
        '基本畫布，具備平移、縮放與旋轉功能。是理解核心功能的最佳起點。',
    'card.attach-detach.title': '掛載 / 卸載範例 (使 canvas 視窗範圍受 Board 控制)',
    'card.attach-detach.desc':
        '展示如何在執行時動態掛載與卸載 canvas（使其視窗範圍受 Board 控制）。',
    'card.ruler.title': '尺規範例',
    'card.ruler.desc':
        '尺規覆蓋層與測量工具。展示如何新增測量與格線覆蓋層。',
    'card.navigation.title': '使用鍵盤控制鏡頭範例',
    'card.navigation.desc':
        '展示如何使用鍵盤控制鏡頭。',
    'card.pixi.title': 'Pixi 整合',
    'card.pixi.desc':
        '與 PixiJS 整合。展示如何搭配 uē-tôo 與 PixiJS 實現高效能圖形。',
    'card.konva.title': 'Konva 整合',
    'card.konva.desc':
        '與 Konva.js 整合。展示如何搭配 uē-tôo 與 Konva.js 實現畫布圖形。',
    'card.fabric.title': 'Fabric 整合',
    'card.fabric.desc':
        '與 Fabric.js 整合。展示 uē-tôo 與 Fabric.js 的互動式畫布物件整合。',
    'card.camera-animation.title': '鏡頭動畫',
    'card.camera-animation.desc':
        '沿著縮放平移路徑的平滑鏡頭飛行。點擊附近任一處飛過去；或走遠後按「回到起點」，看鏡頭拉遠、滑回起點再拉近。',
    'card.svg.title': 'SVG 範例',
    'card.svg.desc': 'SVG 範例。展示如何在 uē-tôo 中使用 SVG。',
    'card.pele-mermaid.title': 'Mermaid（Pele）',
    'card.pele-mermaid.desc':
        '可即時編輯的 Mermaid 圖表，由 Pele 繪製，並以 uē-tôo 鏡頭平移與縮放。',
    'card.state-machine.title': '狀態機視覺化',
    'card.state-machine.desc':
        '互動式狀態機視覺化與模擬器，使用 @ue-too/board 繪製 @ue-too/being 狀態機。',
    'card.image.title': '圖片範例',
    'card.image.desc':
        '圖片操作範例。展示如何在 uē-tôo 中使用圖片。',
    'card.physics.title': '物理範例',
    'card.physics.desc':
        '物理範例。展示如何在 uē-tôo 中使用物理引擎。',
    'card.view': '查看範例',

    // Shared control instructions (HTML)
    'controls.scroll-zoom':
        '<kbd>滾輪</kbd> 縮放',
    'controls.scroll-zoom-short':
        '<kbd>滾輪</kbd> 縮放',
    'controls.scroll-zoom-image':
        '<kbd>滾輪</kbd> 縮放圖片',
    'controls.scroll-zoom-ruler':
        '<kbd>滾輪</kbd> 縮放——觀察尺規刻度的變化',
    'controls.pan':
        '<kbd>中鍵拖曳</kbd> 或 <kbd>空白鍵 + 左鍵拖曳</kbd> 平移',
    'controls.pan-viewport':
        '<kbd>中鍵拖曳</kbd> 或 <kbd>空白鍵 + 左鍵拖曳</kbd> 平移視窗',
    'controls.pan-around':
        '<kbd>中鍵拖曳</kbd> 或 <kbd>空白鍵 + 左鍵拖曳</kbd> 平移畫面',
    'controls.pan-manual':
        '<kbd>中鍵拖曳</kbd> 或 <kbd>空白鍵 + 左鍵拖曳</kbd> 手動平移',
    'controls.pan-ruler':
        '<kbd>中鍵拖曳</kbd> 或 <kbd>空白鍵 + 左鍵拖曳</kbd> 平移——尺規數字會隨之更新以反映可見區域',
    'controls.pan-builtin':
        '<kbd>中鍵拖曳</kbd> 或 <kbd>空白鍵 + 左鍵拖曳</kbd> 平移（內建）',
    'controls.scroll-and-pan':
        '<kbd>滾輪</kbd> 縮放，<kbd>中鍵拖曳</kbd> 或 <kbd>空白鍵 + 左鍵拖曳</kbd> 平移',
    'controls.trackpad':
        '<strong>觸控板：</strong> <kbd>雙指拖曳</kbd> 平移，<kbd>捏合</kbd> 縮放',
    'controls.touch':
        '<strong>觸控：</strong> <kbd>雙指拖曳</kbd> 平移，<kbd>捏合</kbd> 縮放',

    // Base example
    'base.title': '基本範例',
    'base.desc':
        '最簡單的設定：將 Board 掛載至畫布，即可使用內建的平移、縮放與旋轉功能。',
    'base.click-log':
        '<kbd>點擊</kbd> 畫布以在主控台記錄世界座標',

    // Attach/Detach example
    'attach-detach.title': '掛載 / 卸載範例',
    'attach-detach.desc':
        '展示 Board 的生命週期：在執行時動態掛載與卸載畫布。Board 初始為卸載狀態——在掛載前不會繪製任何內容。',
    'attach-detach.attach': '掛載',
    'attach-detach.detach': '卸載',
    'attach-detach.attach-instruction':
        '點擊<strong>掛載</strong>將 Board 連接至畫布並開始繪製',
    'attach-detach.detach-instruction':
        '點擊<strong>卸載</strong>中斷連接——畫布將變為空白且停止接收輸入',
    'attach-detach.reattach': '可隨時重新掛載以恢復',

    // Ruler example
    'ruler.title': '尺規範例',
    'ruler.desc':
        '在畫布邊緣顯示測量尺規覆蓋層。尺規刻度會隨著平移與縮放動態更新，顯示世界空間座標。',

    // Navigation example
    'navigation.title': '導覽範例',
    'navigation.desc':
        '展示如何透過鍵盤輸入以 <code>panByViewPort()</code> 程式化地平移鏡頭。',
    'navigation.wasd':
        '<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> 平移上、左、下、右',
    'navigation.scroll-and-pan':
        '<kbd>滾輪</kbd> 縮放，<kbd>中鍵拖曳</kbd> 或 <kbd>空白鍵 + 左鍵拖曳</kbd> 平移（內建）',

    // Camera Animation example
    'camera-animation.title': '鏡頭動畫',
    'camera-animation.desc':
        '使用 <code>@ue-too/board</code> 的 <code>createZoomPanPath</code>，搭配 <code>@ue-too/animate</code> 驅動平滑的鏡頭飛行。距離較遠時，鏡頭會先拉遠、滑過去，再拉近。',
    'camera-animation.click':
        '<kbd>點擊</kbd> 任意位置，鏡頭將飛到該處',
    'camera-animation.back':
        '<strong>回到起點</strong> 讓鏡頭飛回一開始的位置（橘色十字標記處）',
    'camera-animation.interrupt': '飛行途中平移或縮放即可接手鏡頭',
    'camera-animation.back-button': '回到起點',
    'camera-animation.ruler': '尺規覆蓋層顯示目前的視窗邊界',

    // Image example
    'image.title': '圖片範例',
    'image.desc':
        '上傳圖片以在可平移縮放的畫布上繪製。原點處的彩色座標軸箭頭（紅色 = Y，綠色 = X）顯示世界座標方向。',
    'image.choose': '選擇圖片',
    'image.upload':
        '點擊<strong>選擇圖片</strong>以上傳檔案',

    // SVG example
    'svg.title': 'SVG 範例',
    'svg.desc':
        '使用 Board 鏡頭系統搭配 SVG 元素而非畫布。鏡頭變換（平移、縮放、旋轉）會套用至 SVG <code>&lt;g&gt;</code> 群組。',
    'svg.inputs': '使用以下欄位設定鏡頭位置、旋轉角度與縮放等級',
    'svg.click-log':
        '<kbd>點擊</kbd> 以在主控台記錄視窗與世界座標',
    'svg.rotation': '旋轉',
    'svg.zoom': '縮放',
    'svg.apply': '套用',

    // Pele Mermaid example
    'pele-mermaid.title': '以 Pele 繪製 Mermaid',
    'pele-mermaid.desc':
        'Pele 將 Mermaid 轉成 SVG；board 鏡頭變換包住它的 SVG 群組，因此圖表在任何縮放等級下都保持清晰。',
    'pele-mermaid.editor-label': 'Mermaid 原始碼',
    'pele-mermaid.fit': '完整顯示',
    'pele-mermaid.controls-mouse':
        '<kbd>Ctrl + 滾輪</kbd> 縮放，<kbd>中鍵拖曳</kbd> 或 <kbd>空白鍵 + 左鍵拖曳</kbd> 平移',

    // Pixi example
    'pixi.title': 'PixiJS 整合',
    'pixi.desc':
        '全螢幕 PixiJS 畫布搭配 uē-tôo 鏡頭控制。使用 PixiJS 繪製兔子精靈圖與圓形，同時由 Board 鏡頭處理視窗變換。',
    'pixi.camera-info':
        '鏡頭起始位置 (100, 100)，2 倍縮放，45 度旋轉',

    // Konva example
    'konva.title': 'Konva 整合',
    'konva.desc':
        '將 uē-tôo 鏡頭控制與 Konva.js 整合。使用 Konva 繪製紅色圓形，Board 鏡頭每幀將平移、旋轉與縮放變換套用至 Konva 舞台。',
    'konva.sync':
        'Konva 舞台變換每幀與鏡頭同步',

    // Fabric example
    'fabric.title': 'Fabric.js 整合',
    'fabric.desc':
        '將 uē-tôo 鏡頭控制與 Fabric.js 整合。可切換移動模式（平移/縮放視窗）與選取模式（選取並操作 Fabric 物件）。',
    'fabric.movement':
        '<strong>移動模式</strong>下：<kbd>滾輪</kbd> 縮放，<kbd>中鍵拖曳</kbd> 或 <kbd>空白鍵 + 左鍵拖曳</kbd> 平移',
    'fabric.selection':
        '<strong>選取模式</strong>下：點擊以選取 Fabric 物件（「Hello world!」文字與矩形）',
    'fabric.toggle': '點擊下方按鈕切換模式',
    'fabric.toggle-button': '切換移動模式',

    // Physics example
    'physics.title': '物理範例',
    'physics.desc':
        '以剛體物理與銷接約束模擬的四連桿機構。兩根驅動連桿固定在定點，透過三角連桿相連。',
    'physics.arrows':
        '<kbd>方向鍵</kbd> 對左連桿施加力',
    'physics.qe':
        '<kbd>Q</kbd> / <kbd>E</kbd> 旋轉左連桿',
} as const;

export default zhTW;
