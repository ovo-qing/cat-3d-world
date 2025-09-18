import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 全局状态管理 - 添加图片展示相关配置
const appState = {
  currentView: 'prologue',
  clickCount: 0,
  mouseModel: null,
  raycaster: new THREE.Raycaster(),
  mousePos: new THREE.Vector2(),
  isTransitioning: false,
  backgroundMusic: null,
  // 音效相关
  clickSound: null,
  highlightSound: null,
  soundState: {
    lastHighlightTime: 0,
    highlightCooldown: 1000,
    isClickSoundPlaying: false
  },
  // 光标相关
  customCursor: null,
  mouseOriginalPos: new THREE.Vector3(),
  cursorNormalImage: 'resource/小猫爪1.png',
  cursorClickImage: 'resource/小猫爪2.png',
  cursorHighlightImage: 'resource/小猫爪2.png',
  isCursorInHighlight: false,
  // 动画相关
  mouseAnimationId: null,
  movePath: [],
  currentPathIndex: 0,
  moveSpeed: 0.05,
  lastMoveTime: 0,
  moveInterval: 16,
  // 碰撞检测相关参数
  mouseDetectionRadius: 1.5,
  showDebugSphere: false,
  debugSphere: null,
  cachedMouseChildren: null,
  lastClickTime: 0,
  // 背景相关
  startSceneBackground: null,
  prologueBackgroundImage: 'resource/6766.jpg',
  // 标记点相关
  markImages: {},
  currentMarkImage: null,
  // 地点对应的图片集
  locationImages: {
    rb: ['resource/rb/1.png', 'resource/rb/2.png', 'resource/rb/3.png'],
    trq: ['resource/trq/1.png', 'resource/trq/2.png', 'resource/trq/3.png'],
    ydl: ['resource/ydl/1.png', 'resource/ydl/2.png', 'resource/ydl/3.png'],
    yg: ['resource/yg/1.png', 'resource/yg/2.png', 'resource/yg/3.png'],
    tg: ['resource/tg/1.png', 'resource/tg/2.png', 'resource/tg/3.png'],
    rls: ['resource/rls/1.png', 'resource/rls/2.png', 'resource/rls/3.png'],
    aj: ['resource/aj/1.png', 'resource/aj/2.png', 'resource/aj/3.png']
  },
  // PNG叠加层相关
  pngOverlay: null,
  // 点击更换的图片序列
  catImageSequence: [
    'resource/小猫1.png',  // 索引0: 初始显示
    'resource/小猫3.png',  // 索引1: 第一次点击后
    'resource/小猫5.png'   // 索引2: 第二次及以后点击后
  ]
};

// 核心变量
let renderer, camera, mainScene, mainControls, startScene, prologueScene, prologueCamera;

// 初始化应用
window.addEventListener('load', init);

function init() {
  try {
    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ 
      antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xf0f0f0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // 使用正交相机
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 20;
    camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2, 
      frustumSize * aspect / 2, 
      frustumSize / 2, 
      frustumSize / -2, 
      0.1, 
      1000
    );
    camera.position.set(0, 20, 0);
    camera.lookAt(0, 0, 0);

    // 初始化场景
    initPrologueScene();
    initStartScene();
    initMainScene();

    // 初始化功能模块
    initBackgroundMusic();
    initSoundEffects();
    initCustomCursor();
    initDebugSphere();

    // 绑定事件
    bindEvents();

    // 启动渲染循环
    animate();
    console.log('应用初始化成功');
  } catch (error) {
    console.error('初始化失败:', error);
    alert(`初始化错误: ${error.message}`);
  }
}

// 初始化调试球体
function initDebugSphere() {
  const geometry = new THREE.SphereGeometry(appState.mouseDetectionRadius, 16, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.3,
    wireframe: true
  });
  appState.debugSphere = new THREE.Mesh(geometry, material);
  appState.debugSphere.visible = appState.showDebugSphere;
}

// 序幕场景初始化
function initPrologueScene() {
  prologueScene = new THREE.Scene();
  
  // 保存相机初始状态
  const originalCameraPos = new THREE.Vector3().copy(camera.position);
  const originalCameraTarget = new THREE.Vector3(0, 0, 0);
  
  // 创建序幕场景专用相机
  prologueCamera = new THREE.OrthographicCamera(
    window.innerWidth / -2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    window.innerHeight / -2,
    1,
    1000
  );
  prologueCamera.position.set(0, 0, 100);
  prologueCamera.lookAt(0, 0, 0);
  
  // 设置黑色背景
  prologueScene.background = new THREE.Color(0x000000);
  
  // 加载背景图（使用普通材质，不使用着色器）
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(appState.prologueBackgroundImage, 
    (texture) => {
      const imageAspect = texture.image.width / texture.image.height;
      const scaleFactor = 1.5;
      const maxSize = 1000;
      
      let originalWidth, originalHeight;
      if (imageAspect > 1) {
        originalWidth = maxSize;
        originalHeight = maxSize / imageAspect;
      } else {
        originalHeight = maxSize;
        originalWidth = maxSize * imageAspect;
      }
      
      const displayWidth = originalWidth * scaleFactor;
      const displayHeight = originalHeight * scaleFactor;
      
      // 使用普通材质
      const bgMaterial = new THREE.MeshBasicMaterial({
        map: texture
      });
      
      const bgPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(displayWidth, displayHeight),
        bgMaterial
      );
      
      bgPlane.position.set(0, 0, -10);
      prologueScene.add(bgPlane);
      
      const handleResize = () => {
        prologueCamera.left = window.innerWidth / -2;
        prologueCamera.right = window.innerWidth / 2;
        prologueCamera.top = window.innerHeight / 2;
        prologueCamera.bottom = window.innerHeight / -2;
        prologueCamera.updateProjectionMatrix();
      };
      
      window.addEventListener('resize', handleResize);
      console.log('序幕背景图加载成功');
    },
    (progress) => {
      console.log(`序幕背景图加载中: ${(progress.loaded / progress.total * 100).toFixed(1)}%`);
    },
    (error) => {
      console.error('序幕背景图加载失败:', error);
      prologueScene.background = new THREE.Color(0x2c3e50);
    }
  );

  // 修改渲染循环，使用序幕专用相机
  const originalAnimate = animate;
  animate = function() {
    requestAnimationFrame(animate);

    if (appState.currentView === 'main' && appState.mainUpdate) {
      appState.mainUpdate();
    }

    if (appState.currentView === 'prologue' && !appState.isTransitioning) {
      renderer.render(prologueScene, prologueCamera);
    } else if (appState.currentView === 'start' && !appState.isTransitioning) {
      renderer.render(startScene, camera);
    } else {
      renderer.render(mainScene, camera);
    }
  };

  // 场景切换时恢复相机状态
  const originalSwitchToScene = switchToScene;
  switchToScene = function(sceneName) {
    camera.position.copy(originalCameraPos);
    camera.lookAt(originalCameraTarget);
    camera.updateProjectionMatrix();
    originalSwitchToScene(sceneName);
  };
}

// 老鼠场景（第二幕）
function initStartScene() {
  startScene = new THREE.Scene();
  startScene.visible = false;
  appState.startScene = startScene;

  if (appState.debugSphere) {
    startScene.add(appState.debugSphere);
  }

  // 创建PNG图片平面
  const pngLoader = new THREE.TextureLoader();
  pngLoader.load(appState.catImageSequence[0], 
    (texture) => {
      texture.alphaTest = 0.5;
      
      const pngPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(25, 25),
        new THREE.MeshBasicMaterial({ 
          map: texture,
          transparent: true,
          side: THREE.DoubleSide
        })
      );
      
      pngPlane.position.set(0, 6, -2);
      pngPlane.lookAt(camera.position);
      
      pngPlane.name = "overlayImage";
      startScene.add(pngPlane);
      appState.pngOverlay = pngPlane;
      console.log('初始PNG图片（小猫1）加载成功');
    },
    (progress) => {
      console.log(`PNG图片加载中: ${(progress.loaded / progress.total * 100).toFixed(1)}%`);
    },
    (error) => {
      console.error('PNG图片加载失败:', error);
    }
  );

  // 创建地面容器
  const groundContainer = new THREE.Group();
  startScene.add(groundContainer);
  
  // 背景图片
  const backgroundImages = ['resource/miao1.jpg'];
  
  // 加载背景图
  const textureLoader = new THREE.TextureLoader();
  backgroundImages.forEach((imagePath) => {
    textureLoader.load(imagePath, 
      (texture) => {
        const imgAspect = texture.image.width / texture.image.height;
        const windowAspect = window.innerWidth / window.innerHeight;
        
        let groundWidth, groundHeight;
        const cameraFrustumHeight = 20;
        
        if (windowAspect > imgAspect) {
          groundHeight = cameraFrustumHeight;
          groundWidth = groundHeight * windowAspect;
        } else {
          groundWidth = cameraFrustumHeight * windowAspect;
          groundHeight = cameraFrustumHeight;
        }
        
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        const groundPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(groundWidth, groundHeight),
          new THREE.MeshBasicMaterial({ 
            map: texture, 
            side: THREE.DoubleSide 
          })
        );
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.y = -0.1;
        groundPlane.visible = true;
        
        groundContainer.add(groundPlane);
        appState.startSceneBackground = groundPlane;
        
        window.addEventListener('resize', () => {
          const newAspect = window.innerWidth / window.innerHeight;
          let newWidth, newHeight;
          
          if (newAspect > imgAspect) {
            newHeight = cameraFrustumHeight;
            newWidth = newHeight * newAspect;
          } else {
            newWidth = cameraFrustumHeight * newAspect;
            newHeight = cameraFrustumHeight;
          }
          
          groundPlane.geometry.dispose();
          groundPlane.geometry = new THREE.PlaneGeometry(newWidth, newHeight);
        });
      },
      (progress) => {
        console.log(`地面 ${imagePath} 加载中: ${(progress.loaded / progress.total * 100).toFixed(1)}%`);
      },
      (error) => {
        console.error(`地面 ${imagePath} 加载失败:`, error);
        const fallbackGround = new THREE.Mesh(
          new THREE.PlaneGeometry(40, 20),
          new THREE.MeshBasicMaterial({ color: 0xe0e0e0 })
        );
        fallbackGround.rotation.x = -Math.PI / 2;
        fallbackGround.position.y = -0.1;
        fallbackGround.visible = true;
        groundContainer.add(fallbackGround);
        appState.startSceneBackground = fallbackGround;
      }
    );
  });

  // 老鼠路径
  appState.movePath = [
    new THREE.Vector3(-10, 0, -5),
    new THREE.Vector3(10, 0, -5),
    new THREE.Vector3(10, 0, 5),
    new THREE.Vector3(-10, 0, 5),
    new THREE.Vector3(-10, 0, -5)
  ];

  // 加载老鼠模型
  const gltfLoader = new GLTFLoader();
  gltfLoader.load('resource/mouse.glb',
    (gltf) => {
      const mouseModel = gltf.scene;
      appState.mouseModel = mouseModel;

      mouseModel.scale.set(3, 3, 3);
      mouseModel.position.copy(appState.movePath[0]);
      appState.mouseOriginalPos.copy(mouseModel.position);

      const modelBox = new THREE.Box3().setFromObject(mouseModel);
      const modelMinY = modelBox.min.y;
      const baseYPosition = -0.5;
      
      if (modelMinY < baseYPosition) {
        mouseModel.position.y = baseYPosition - modelMinY;
        appState.mouseOriginalPos.copy(mouseModel.position);
        appState.movePath.forEach(point => {
          point.y = mouseModel.position.y;
        });
      }

      mouseModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.userData.isMouse = true;
          child.material.side = THREE.DoubleSide;
        }
      });

      startScene.add(mouseModel);
      console.log('老鼠模型加载成功，启动路径移动');
      startMousePathMovement();
    },
    (progress) => {
      console.log(`老鼠模型加载中: ${(progress.loaded / progress.total * 100).toFixed(1)}%`);
    },
    (error) => {
      console.error('老鼠模型加载失败:', error);
      // 备用老鼠模型
      const group = new THREE.Group();
      
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 1.2, 3.5),
        new THREE.MeshBasicMaterial({ color: 0xff6600 })
      );
      body.position.set(0, 1, 0);
      body.userData.isMouse = true;
      
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(1.0),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      head.position.set(0, 1, 1.8);
      head.userData.isMouse = true;
      
      group.add(body);
      group.add(head);
      
      group.position.copy(appState.movePath[0]);
      group.position.y = 0.8;
      appState.mouseOriginalPos.copy(group.position);
      
      appState.movePath.forEach(point => {
        point.y = group.position.y;
      });
      
      startScene.add(group);
      appState.mouseModel = group;
      
      console.log('使用备用老鼠模型，启动路径移动');
      startMousePathMovement();
    }
  );

  // 灯光设置
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
  startScene.add(ambientLight);


  // 点击次数提示文字
  const tipElement = document.createElement('div');
  tipElement.id = 'start-tip';
  tipElement.style.display = 'none';
  Object.assign(tipElement.style, {
    position: 'absolute',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 24px',
    backgroundColor: 'rgba(255,255,255,0.9)',
    color: '#333',
    fontSize: '24px',
    fontFamily: 'Arial',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    zIndex: 9999,
    textAlign: 'center',
    transition: 'opacity 0.5s ease-out',
    opacity: 1
  });
  tipElement.innerHTML = `点击老鼠<br>还需 ${3 - appState.clickCount} 次`;
  document.body.appendChild(tipElement);
}

// 老鼠沿预设路径连续移动
function startMousePathMovement() {
  if (appState.mouseAnimationId) {
    cancelAnimationFrame(appState.mouseAnimationId);
    appState.mouseAnimationId = null;
  }

  if (!appState.mouseModel) {
    setTimeout(startMousePathMovement, 100);
    return;
  }

  const mouse = appState.mouseModel;
  console.log('老鼠开始移动');
  
  function animateMovement() {
    if (appState.currentView !== 'start') {
      appState.mouseAnimationId = requestAnimationFrame(animateMovement);
      return;
    }

    if (appState.debugSphere) {
      appState.debugSphere.position.copy(mouse.position);
    }

    const now = Date.now();
    if (now - appState.lastMoveTime < appState.moveInterval) {
      appState.mouseAnimationId = requestAnimationFrame(animateMovement);
      return;
    }
    appState.lastMoveTime = now;

    const targetPoint = appState.movePath[appState.currentPathIndex];
    const direction = new THREE.Vector3().subVectors(targetPoint, mouse.position);
    const distance = direction.length();
    
    if (distance < 0.5) { 
      appState.currentPathIndex = (appState.currentPathIndex + 1) % appState.movePath.length;
    } else {
      direction.normalize().multiplyScalar(appState.moveSpeed);
      mouse.position.add(direction);
      
      const lookAtPoint = new THREE.Vector3(targetPoint.x, mouse.position.y, targetPoint.z);
      mouse.lookAt(lookAtPoint);
    }
    
    const bobHeight = 0.15;
    const bobSpeed = 2;
    mouse.position.y = appState.movePath[0].y + Math.sin(Date.now() * 0.001 * bobSpeed) * bobHeight;
    
    appState.mouseAnimationId = requestAnimationFrame(animateMovement);
  }

  appState.mouseAnimationId = requestAnimationFrame(animateMovement);
}

// 主场景（第三幕）- 添加地点图片展示功能
function initMainScene() {
  mainScene = new THREE.Scene();
  mainScene.visible = false;

  // 创建黄白渐变背景（上浅黄下白）
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  
  // 创建渐变：上浅黄下白
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#fffacd'); // 顶部浅黄
  gradient.addColorStop(0.5, '#fffdf0'); // 中间过渡色
  gradient.addColorStop(1, '#ffffff'); // 底部白色
  
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  // 将Canvas转换为纹理并设置为主场景背景
  const gradientTexture = new THREE.CanvasTexture(canvas);
  mainScene.background = gradientTexture;

  // 增强主场景光线
  const ambientLight = new THREE.AmbientLight(0xffffff, 2.7);
  mainScene.add(ambientLight);

  // 调整主场景相机位置
  camera.position.set(0, 40, 0);
  camera.lookAt(0, 0, 0);

  // 主场景控制器
  mainControls = new OrbitControls(camera, renderer.domElement);
  mainControls.enableDamping = true;
  mainControls.dampingFactor = 0.05;
  mainControls.target.set(0, 0, 0);
  mainControls.enablePan = true;
  mainControls.enableZoom = true;
  mainControls.minZoom = 0.3;
  mainControls.maxZoom = 3.0;
  mainControls.zoomSpeed = 0.5;
  mainControls.minPolarAngle = Math.PI / 4;
  mainControls.maxPolarAngle = Math.PI / 2;
  mainControls.update();
  mainControls.enabled = false;

  // 创建地点图片容器（屏幕左侧）
  const createImageContainer = () => {
    const container = document.createElement('div');
    container.id = 'location-images-container';
    Object.assign(container.style, {
      position: 'absolute',
      top: '50%',
      left: '20px',
      transform: 'translateY(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      zIndex: 9998,
      opacity: 0,
      transition: 'opacity 0.3s ease-out',
      pointerEvents: 'none'
    });
    document.body.appendChild(container);
    
    // 创建三个图片元素
    for (let i = 0; i < 3; i++) {
      const img = document.createElement('img');
      img.id = `location-image-${i}`;
      Object.assign(img.style, {
        width: '280px',
        height: '210px',
        objectFit: 'cover',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        border: '2px solid white',
        transition: 'transform 0.3s ease'
      });
      container.appendChild(img);
    }
    
    return container;
  };
  
  // 创建图片容器
  const imageContainer = createImageContainer();

  // 模型配置
  const modelsToLoad = [
    { path: 'resource/diqiu.glb', position: new THREE.Vector3(0, 0, 0), scale: 3 },
    { path: 'resource/mark.glb', position: new THREE.Vector3(4,6.5,4.3), scale:0.7 , name:'rls', rotation: { x: THREE.MathUtils.degToRad(80), y: THREE.MathUtils.degToRad(40), z: THREE.MathUtils.degToRad(120) } },
    { path: 'resource/mark.glb', position: new THREE.Vector3(2.5,4, -6.5), scale:0.7 , name:'rb', rotation: { x: THREE.MathUtils.degToRad(110), y: THREE.MathUtils.degToRad(20), z: THREE.MathUtils.degToRad(20) } },
    { path: 'resource/mark.glb', position: new THREE.Vector3(5.5,2,7.8), scale:0.7 , name:'trq', rotation: { x: THREE.MathUtils.degToRad(80), y: THREE.MathUtils.degToRad(10), z: THREE.MathUtils.degToRad(150) } },
    { path: 'resource/mark.glb', position: new THREE.Vector3(2.3,2.4,9.3), scale:0.7 , name:'ydl', rotation: { x: THREE.MathUtils.degToRad(80), y: THREE.MathUtils.degToRad(0), z: THREE.MathUtils.degToRad(160) } },
    { path: 'resource/mark.glb', position: new THREE.Vector3(1.5,4.7,8.3), scale:0.7 , name:'yg', rotation: { x: THREE.MathUtils.degToRad(50), y: THREE.MathUtils.degToRad(-10), z: THREE.MathUtils.degToRad(170) } },
    { path: 'resource/mark.glb', position: new THREE.Vector3(8.7,-2.8, -1.3), scale:0.7 , name:'tg', rotation: { x: THREE.MathUtils.degToRad(100), y: THREE.MathUtils.degToRad(-10), z: THREE.MathUtils.degToRad(70) } },
    { path: 'resource/mark.glb', position: new THREE.Vector3(5.5,0,8.5), scale:0.7 , name:'aj', rotation: { x: THREE.MathUtils.degToRad(80), y: THREE.MathUtils.degToRad(10), z: THREE.MathUtils.degToRad(150) } }
  ];

  // 标记点交互变量
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let lastHoveredMark = null;
  let tooltip = null; // 消息框元素
  
  // 标记点消息数据
  const markMessages = {
      rb:  "日本\n\n流行与二次元交融的猫咪王国\n日本的猫咪早已超越宠物属性，深度融入文化肌理，构建起全球知名的猫咪文化版图。作为经典符号的招财猫，因商家养猫防鼠的传统渐与 “招财” 绑定，右手招财、左手揽客，不同颜色和配饰各有寓意；爱知县、冈山县等地有招财猫博物馆，东京今户神社、豪德寺更是将其融入建筑与祭祀，成了文化标志。\n在现代流行与二次元领域，日本创造了众多全球知名的猫咪形象。1974 年诞生的 Hello Kitty 商业影响力巨大，2023 年第二季度带动三丽鸥销售额达 203 亿日元；哆啦 A 梦、《猫的报恩》里的猫男爵、《魔女宅急便》的吉吉等，既是二次元文化的核心元素，也成了日本文化输出的重要载体，海关海报、旅游应用都可见其身影。\n现实中的猫咪主题场所同样丰富。1987 年确立的 2 月 22 日 “猫之日” 会举办各类活动，猫咖啡馆让人们付费与猫互动解压；沿海 “六大猫岛” 如田代岛是 “猫的天堂”，和歌山县电铁的猫站长 “小玉” 曾带火车站，京都猫猫庙更是集艺术与祭祀于一体的独特场所，全方位展现了日本猫咪文化的魅力。\n",
    trq: "土耳其\n\n流浪猫的天堂与城市灵魂\n土耳其，尤其是伊斯坦布尔，是全球闻名的 “猫咪友好之城”。这里约有 12.5 万只流浪猫栖息，它们自在穿梭于街巷、公交、咖啡馆，甚至教堂台阶，仿佛城市的 “原住民”，毫无拘束地融入人类生活，成为伊斯坦布尔独特的风景线。\n当地人对流浪猫的爱护刻入文化基因。受伊斯兰教文化影响，猫被视作洁净生灵，先知穆罕默德爱猫的传说广为流传，民间更有 “伤害猫需以建清真寺赎罪” 的谚语。居民会自发在门口、街头放置食水，市政府也设自动投喂机、兽医流动巴士，还通过立法禁止虐待流浪猫，划定专项经费为其绝育、体检，构建起完善的保护体系。\n这种人与猫的共生关系，让土耳其成为爱猫者的向往之地。2016 年纪录片《爱猫之城》更是将这份温暖传遍全球，猫咪不仅是城市的守护者，更成为土耳其的文化符号，吸引着游客专程前来，感受这份跨越物种的和谐与温情。",
    ydl: "意大利\n\n爱猫传统与流浪猫保护的先驱\n意大利的爱猫传统源远流长，可追溯至古罗马时期。当时猫因象征自由独立，被政治家提比略・格拉古置于自由女神雕塑基座旁，还是神庙中唯一能自由穿梭的动物。庞贝古城遗址中，猫的遗骸与猫主题马赛克作品，印证了猫在古人生活中的重要性；后来猫又因出色捕鼠能力，成为控制城市鼠患的得力助手，进一步巩固了在人们心中的地位。\n步入现代，意大利对流浪猫的保护堪称典范。国家立法明确将无主流浪猫视作城市市长财产，禁止伤害或随意转移，为其提供法律庇护。以罗马为例，登记在册的猫群超 5000 个，著名的 “罗马屠牛场遗址猫保护区”（银塔猫猫保护区）坐落于古罗马遗址间，流浪猫在古迹中栖息奔跑，成了独特的城市景观。\n志愿者组织是流浪猫保护的重要力量。罗马志愿者 “gattare” 长期照料流浪猫，电影明星等爱心人士也曾参与其中；1994 年成立的银塔保护区，为流浪猫提供绝育、医疗、领养等服务，如今猫群约 130 只，还成了观光景点。意大利各地志愿者组织在政府支持下积极行动，让其在欧洲流浪猫保护领域处于领先地位，也让古老的爱猫传统焕发新生。",
    yg:    "英国\n\n猫咪福利与品种培育的标杆\n英国在猫咪领域地位突出，是福利保障与品种培育的典范。1927 年成立的 “猫咪保护联盟”，通过发布护理指南、开展教育项目普及猫咪需求；各地小型组织深入社区，为流浪猫提供绝育、疫苗服务，再加上禁止遗弃猫咪的严苛法律，共同筑牢猫咪权益防线。\n作为知名猫种发源地，英国在纯种猫培育上成果卓越。英国短毛猫历史可追溯至古罗马时期，经选育后 1871 年亮相伦敦展会成名，如今占英国 GCCF 年度注册小猫的四分之一；17 世纪引入的波斯猫，经与土耳其安哥拉猫杂交改良，成了毛发飘逸、面容甜美的经典品种。\n此外，苏格兰折耳猫（因苏格兰农场发现的折耳基因培育而成）、曼岛猫（以无尾特征闻名）等，也在英国繁育体系中发展完善。繁育者遵循严格标准，借科学技术筛选优良基因，既保证猫种健康独特，也推动了全球纯种猫事业发展。",
    tg:    "泰国\n\n本土猫种与寺庙猫交织的独特猫文化\n泰国的猫文化底蕴深厚，本土特色猫种是重要标志。暹罗猫作为泰国最负盛名的猫种，200 多年前仅在王宫和大寺院饲养，是贵族专属。其身姿优雅、蓝眼迷人，14 世纪《猫之诗》中就有记载，被视为 “神殿守护之神”，19 世纪末作为国礼赠予英美后走向世界。柯拉特猫则来自考拉特高原，银蓝色毛发与碧绿眼眸极具辨识度，当地称其 “西塞瓦特”，象征吉祥，常被作为结婚贺礼，引入美国后也广受喜爱。\n寺庙猫是泰国猫文化的另一独特景观。泰国约 3 万座寺庙几乎都接纳流浪猫，且多为暹罗猫。因近九成民众信佛，佛教 “尊重生命” 的理念让寺庙猫备受呵护，僧侣会为其提供食住。在泰国文化中，寺庙猫被视作有灵性的存在，是连接世俗与神圣的使者，守护着寺庙的宁静。\n部分寺庙还保留着与猫相关的独特传统。比如斯瑞拉察的一间小寺庙，要求每位僧人带猫参佛，认为猫参悟能力强、是佛的化身。僧人挑选猫时，会在小猫旁念经，主动接触僧人的小猫即被视为 “结缘成功”。这些传统让佛教文化与猫咪文化深度交融，构成泰国独有的猫文化图景。",
    rls: "俄罗斯\n\n猫文化深厚的 “北国猫国”\n本土名猫辈出：拥有俄罗斯蓝猫（“冬天的精灵”，曾为《猫和老鼠》汤姆原型）、西伯利亚森林猫（国猫，体型大、抗寒强）等特色品种，本土猫种资源丰富。\n爱猫传统悠久：历史上猫是家庭保护神，沙皇家族（如彼得大帝）热衷养猫；旧俄时期商店以猫胖为富态象征，海军、乔迁也有养猫 / 让猫先入室的习俗。\n文学与历史印记：普希金、托尔斯泰等作家作品中常出现猫形象；二战列宁格勒围城时，“猫士兵” 灭鼠救城，如今圣彼得堡有猫雕塑纪念其贡献。\n养猫基数与氛围：曾有调查显示超 59% 受访者养猫，是东欧最大宠物猫饲料市场，且有 “True Friend” 等组织致力于流浪猫救助与保护。",
    aj:    "埃及\n\n猫咪崇拜的源起之地\n埃及，作为猫咪崇拜的源起之地，在猫咪文化发展史上占据着无可替代的关键地位。古埃及时期，猫被尊奉为神明，猫首人身的巴斯特女神广受敬拜，她不仅是家庭的守护者，庇佑人们免受邪恶侵扰，还象征着生育与丰收 ，给人们带来富足与希望。彼时，猫被视作女神的化身，其地位尊崇无比。倘若家中的猫不幸离世，全家人都会剃掉眉毛以示哀悼，足见猫在古埃及人心中的分量。\n埃及的历史遗迹和艺术作品中，猫的形象随处可见。诸多神庙的墙壁上刻有猫的浮雕，它们或优雅端坐，或灵动奔跑；墓室壁画里，猫也常陪伴在主人身旁，寓意着在来世继续为主人守护 。考古学家还发掘出大量猫木乃伊，制作工艺精良，有的猫木乃伊甚至佩戴着珍贵的珠宝，足以证明古埃及人对猫的敬重与珍视。\n尽管时光流转至现代，埃及的猫咪地位已与古代大不相同，但深厚的历史文化底蕴，让猫在埃及社会依旧有着独特意义。开罗、亚历山大等城市的街头巷尾，随处都能看到悠然自得的猫咪身影。它们穿梭于古建筑间、居民住宅旁，成为城市独特的风景线。民众对猫咪普遍持有友善态度，不少人会自发投喂食物，为猫咪提供栖身之所，延续着埃及人与猫之间长久以来的特殊情感纽带 。"
   };

  // 创建提示框（消息框）
  function createTooltip() {
    // 移除已存在的提示框
    const existingTooltip = document.getElementById('mark-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    // 创建新的消息框
    tooltip = document.createElement('div');
    tooltip.id = 'mark-tooltip';

    const tooltipText = document.createElement('div');
    tooltipText.id = 'tooltip-text';
    tooltip.appendChild(tooltipText);

    Object.assign(tooltip.style, {
      position: 'absolute',
      position: 'absolute',
      color: '#8B4513',  // 棕色字体
      padding: '12px 16px',
      borderRadius: '6px',
      fontSize: '16px',
      fontFamily: 'Arial',
      pointerEvents: 'none',
      display: 'none',
      whiteSpace: 'pre-line',
      zIndex: 99999,
      backgroundColor: '#FFE4B5',  // 浅橘色底色
      border: '2px solid #8B4513',  // 棕色边框
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)'  // 轻微阴影增强可读性
    });
    
    document.body.appendChild(tooltip);
  }
  
  // 立即创建消息框
  createTooltip();

  // 鼠标移动事件
  window.addEventListener('mousemove', (event) => {
    if (appState.currentView !== 'main' || !tooltip) return;
    
    // 更新鼠标位置
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  // 模型加载函数
  function loadModel(modelInfo) {
    const loader = new GLTFLoader();
    
    loader.load(
      modelInfo.path,
      (gltf) => {
        console.log(`模型加载成功：${modelInfo.name || modelInfo.path}`);
        
        const modelGroup = new THREE.Group();
        const originalModel = gltf.scene;

        const modelBox = new THREE.Box3().setFromObject(originalModel);
        const center = new THREE.Vector3();
        modelBox.getCenter(center);

        originalModel.position.sub(center);
        modelGroup.add(originalModel);

        modelGroup.position.copy(modelInfo.position).add(center);
        modelGroup.scale.set(modelInfo.scale, modelInfo.scale, modelInfo.scale);
        if (modelInfo.rotation) {
          modelGroup.rotation.x = modelInfo.rotation.x || 0;
          modelGroup.rotation.y = modelInfo.rotation.y || 0;
          modelGroup.rotation.z = modelInfo.rotation.z || 0;
        }

        // 为标记点设置明确标识
        if (modelInfo.name) {
          modelGroup.userData.isMark = true;
          modelGroup.userData.markName = modelInfo.name;
          
          // 为每个网格设置标识
          modelGroup.traverse((child) => {
            if (child.isMesh) {
              child.userData.isMark = true;
              child.userData.markName = modelInfo.name;
              child.userData.originalMaterial = child.material.clone();
              child.userData.originalColor = child.material.color.clone();
            }
          });
        }

        modelGroup.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material.isMeshStandardMaterial) {
              child.material.roughness = 0.7;
              child.material.metalness = 0.1;
            }
          }
        });

        mainScene.add(modelGroup);
      },
      (progress) => {
        const percent = (progress.loaded / progress.total * 100).toFixed(1);
        console.log(`加载 ${modelInfo.path}: ${percent}%`);
      },
      (error) => {
        console.error(`模型加载失败 [${modelInfo.path}]:`, error);
      }
    );
  }

  // 加载所有模型
  modelsToLoad.forEach(modelInfo => loadModel(modelInfo));

  // 显示地点对应的图片
  function showLocationImages(markName) {
    const images = appState.locationImages[markName];
    if (!images || images.length === 0) return;
    
    // 显示容器并设置透明度
    imageContainer.style.opacity = '1';
    
    // 更新图片
    images.forEach((src, index) => {
      if (index < 3) { // 确保只处理前3张图片
        const imgElement = document.getElementById(`location-image-${index}`);
        if (imgElement) {
          imgElement.src = src;
          imgElement.alt = `${markName}的图片${index + 1}`;
          
          // 添加加载动画
          imgElement.style.transform = 'scale(0.9)';
          setTimeout(() => {
            imgElement.style.transform = 'scale(1)';
          }, 50);
        }
      }
    });
  }

  // 隐藏地点图片
  function hideLocationImages() {
    imageContainer.style.opacity = '0';
    
    // 重置图片变换
    for (let i = 0; i < 3; i++) {
      const imgElement = document.getElementById(`location-image-${i}`);
      if (imgElement) {
        imgElement.style.transform = 'scale(0.9)';
      }
    }
  }

  // 标记点高亮函数 - 使用脉冲着色器效果（保留）
  function highlightMark(markObject) {
    if (markObject.isMesh && markObject.userData.originalMaterial) {
      // 如果还没有创建着色器材质，初始化一次
      if (!markObject.userData.shaderMaterial) {
        markObject.userData.shaderMaterial = new THREE.ShaderMaterial({
          vertexShader: `
            uniform float time;
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float time;
            varying vec2 vUv;
            
            void main() {
              // 计算脉冲范围（从中心向外扩散）
              float centerDist = length(vUv - 0.5); // 像素到中心点的距离
              float pulse = sin(time * 3.0 - centerDist * 10.0) * 0.5 + 0.5; // 脉冲波形
              
              // 高亮颜色（黄色+脉冲发光）
              vec3 color = vec3(1.0, 1.0, 0.0) * (1.0 - centerDist * 1.5) + pulse * 0.5;
              gl_FragColor = vec4(color, 1.0);
            }
          `,
          uniforms: {
            time: { value: 0 }
          }
        });
      }
      
      // 使用着色器材质
      markObject.material = markObject.userData.shaderMaterial;
    }
  }

  // 重置标记点高亮
  function resetMarkHighlight(markObject) {
    if (markObject.isMesh && markObject.userData.originalMaterial) {
      markObject.material = markObject.userData.originalMaterial;
      markObject.material.color.copy(markObject.userData.originalColor);
    }
  }

  // 主场景更新函数
  appState.mainUpdate = () => {
    if (!mainControls || !tooltip) return;
    mainControls.update();
    
    // 如果有悬停的标记点，更新其着色器时间（让脉冲效果动起来）
    if (lastHoveredMark && lastHoveredMark.userData.shaderMaterial) {
      lastHoveredMark.userData.shaderMaterial.uniforms.time.value += 0.01;
    }
    
    // 收集所有标记点网格
    const allMarks = [];
    mainScene.traverse(obj => {
      if (obj.isMesh && obj.userData.isMark) {
        allMarks.push(obj);
      }
    });
    
    // 执行射线检测
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(allMarks, false);

    // 重置上一个标记点状态和消息框
    if (lastHoveredMark) {
      resetMarkHighlight(lastHoveredMark);
      lastHoveredMark = null;
      appState.isCursorInHighlight = false;
      updateCursorImage();
      
      // 隐藏消息框和图片
      tooltip.style.display = 'none';
      hideLocationImages();
    }

    // 检测到碰撞 - 显示消息框和图片
    if (intersects.length > 0) {
      const firstHit = intersects[0];
      lastHoveredMark = firstHit.object;
      
      // 高亮标记点
      highlightMark(lastHoveredMark);
      
      // 播放高亮音效
      const now = Date.now();
      if (appState.highlightSound && now - appState.soundState.lastHighlightTime > appState.soundState.highlightCooldown) {
        appState.highlightSound.pause();
        appState.highlightSound.currentTime = 0;
        appState.highlightSound.play().catch(err => {
          console.log('播放高亮音效失败:', err);
        });
        appState.soundState.lastHighlightTime = now;
      }
      
      // 显示消息框
      const markName = lastHoveredMark.userData.markName;
      const message = markMessages[markName] || `未配置${markName}的消息`;
      
      // 设置消息内容
      if (tooltip.firstChild) {
        tooltip.firstChild.textContent = message;
      }
      
      // 计算屏幕位置
      const mouseX = (mouse.x + 1) * window.innerWidth / 2;
      const mouseY = (-mouse.y + 1) * window.innerHeight / 2;
      
      // 设置位置和显示
      tooltip.style.left = `${mouseX + 10}px`;
      tooltip.style.top = `${mouseY + 10}px`;
      tooltip.style.display = 'block';
      
      // 显示地点对应的图片
      showLocationImages(markName);
      
      appState.isCursorInHighlight = true;
      updateCursorImage();
    }
  };

  // 主场景操作说明
  const instructions = document.createElement('div');
  instructions.id = 'main-instructions';
  instructions.style.display = 'none';
  Object.assign(instructions.style, {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    backgroundColor: '#FFE4B5', // 浅橘色底色
    color: '#8B4513', // 棕色字体
    padding: '10px',
    borderRadius: '5px',
    fontFamily: 'Arial',
    fontSize: '12px',
    border: '2px solid #8B4513' // 棕色边框
  });
  instructions.innerHTML = `
    <p>操作说明:</p>
    <p>• 拖动鼠标: 旋转视角</p>
    <p>• 滚动鼠标滚轮: 缩放</p>
    <p>• Shift+拖动: 平移</p>
    <p>• 鼠标悬停标记点: 查看详情、图片并播放音效</p>
  `;
  document.body.appendChild(instructions);
  appState.mainInstructions = instructions;
}

// 初始化背景音乐
function initBackgroundMusic() {
  try {
    const audio = new Audio('resource/Relax.mp3');
    audio.loop = true;
    audio.volume = 0.3;
    appState.backgroundMusic = audio;

    audio.play().catch(err => {
      console.log('自动播放失败，等待用户交互后播放:', err);
      document.body.addEventListener('click', () => {
        if (audio.paused) {
          audio.play().catch(err => {
            console.log('音乐播放需要用户交互:', err);
          });
        }
      }, { once: true });
    });
  } catch (error) {
    console.error('音乐初始化失败:', error);
  }
}

// 初始化音效
function initSoundEffects() {
  try {
    const clickSound = new Audio('resource/Meow.ogg'); 
    clickSound.volume = 0.5;
    appState.clickSound = clickSound;

    const highlightSound = new Audio('resource/click.ogg');
    highlightSound.volume = 1;
    appState.highlightSound = highlightSound;
    
    console.log('音效初始化成功');
  } catch (error) {
    console.error('音效初始化失败:', error);
  }
}

// 初始化自定义光标
function initCustomCursor() {
  try {
    const existingCursor = document.getElementById('custom-cursor');
    if (existingCursor) existingCursor.remove();

    const cursor = document.createElement('div');
    cursor.id = 'custom-cursor';
    Object.assign(cursor.style, {
      position: 'absolute',
      width: '64px',
      height: '64px',
      backgroundImage: `url("${appState.cursorNormalImage}")`,
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      pointerEvents: 'none',
      zIndex: 99999,
      display: 'block',
      transform: 'translate(-50%, -50%)',
      transition: 'background-image 0.1s ease'
    });
    document.body.appendChild(cursor);
    appState.customCursor = cursor;

    document.body.style.cursor = 'none !important';

    validateCursorImages();
  } catch (error) {
    console.error('自定义光标初始化失败:', error);
    document.body.style.cursor = 'none';
  }
}

// 验证所有光标图片是否可加载
function validateCursorImages() {
  const validateImage = (src, name) => {
    const img = new Image();
    img.src = src;
    img.onload = () => console.log(`${name}图片加载成功`);
    img.onerror = () => console.error(`${name}图片加载失败，请检查路径: ${src}`);
  };

  validateImage(appState.cursorNormalImage, '正常光标');
  validateImage(appState.cursorClickImage, '点击光标');
  validateImage(appState.cursorHighlightImage, '高亮光标');
  validateImage(appState.prologueBackgroundImage, '序幕背景');
  
  appState.catImageSequence.forEach((src, index) => {
    validateImage(src, `小猫图片${index + 1}`);
  });
  
  // 验证地点图片
  Object.keys(appState.locationImages).forEach(location => {
    appState.locationImages[location].forEach((src, index) => {
      validateImage(src, `${location}的图片${index + 1}`);
    });
  });
}

// 更新光标图片
function updateCursorImage() {
  if (!appState.customCursor) return;

  let imageSrc = appState.cursorNormalImage;
  if (appState.isCursorInHighlight) {
    imageSrc = appState.cursorHighlightImage;
  }

  appState.customCursor.style.backgroundImage = `url("${imageSrc}")`;
}

// 窗口大小调整事件处理
function bindEvents() {
  window.addEventListener('resize', () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    
    const aspect = newWidth / newHeight;
    const frustumSize = 20;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / -2;
    camera.updateProjectionMatrix();
    
    renderer.setSize(newWidth, newHeight);
  });
  
  window.addEventListener('click', handleMouseClick);
  window.addEventListener('mousemove', handleMouseMove);
  
  window.addEventListener('keydown', (e) => {
    // 按D键显示/隐藏调试球体
    if (e.key === 'd' || e.key === 'D') {
      appState.showDebugSphere = !appState.showDebugSphere;
      if (appState.debugSphere) {
        appState.debugSphere.visible = appState.showDebugSphere;
        console.log(`调试球体 ${appState.showDebugSphere ? '显示' : '隐藏'}`);
      }
    }
  });
}

// 处理鼠标移动
function handleMouseMove(e) {
  if (appState.customCursor) {
    appState.customCursor.style.left = `${e.clientX}px`;
    appState.customCursor.style.top = `${e.clientY}px`;
  }
  
  if (appState.currentView === 'start') {
    appState.isCursorInHighlight = false;
    updateCursorImage();
    return;
  }
}

// 处理鼠标点击
function handleMouseClick(e) {
  if (appState.isTransitioning) return;

  const now = Date.now();
  if (appState.lastClickTime && now - appState.lastClickTime < 300) {
    return;
  }
  appState.lastClickTime = now;

  if (appState.currentView === 'prologue') {
    switchToScene('start');
    document.getElementById('start-tip').style.display = 'block';
    return;
  }

  if (appState.currentView === 'start' && appState.mouseModel && appState.clickCount < 3) {
    appState.mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
    appState.mousePos.y = -(e.clientY / window.innerHeight) * 2 + 1;
    appState.raycaster.setFromCamera(appState.mousePos, camera);
    
    let mouseChildren = [];
    if (!appState.cachedMouseChildren) {
      appState.mouseModel.traverse(child => {
        if (child.isMesh && child.userData.isMouse) {
          mouseChildren.push(child);
        }
      });
      appState.cachedMouseChildren = mouseChildren;
    } else {
      mouseChildren = appState.cachedMouseChildren;
    }
    
    const meshIntersects = appState.raycaster.intersectObjects(mouseChildren);
    
    const ray = new THREE.Raycaster();
    ray.setFromCamera(appState.mousePos, camera);
    
    const plane = new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), appState.mouseModel.position);
    const intersectionPoint = new THREE.Vector3();
    ray.ray.intersectPlane(plane, intersectionPoint);
    
    const distanceToMouse = intersectionPoint.distanceTo(appState.mouseModel.position);
    const isNearMouse = distanceToMouse < appState.mouseDetectionRadius;
    
    if (meshIntersects.length > 0 || isNearMouse) {
      console.log(`成功点击老鼠！距离: ${distanceToMouse.toFixed(2)}，次数: ${appState.clickCount + 1}`);
      
      if (appState.clickSound) {
        appState.soundState.isClickSoundPlaying = false;
        
        try {
          appState.clickSound.pause();
          appState.clickSound.currentTime = 0;
          appState.clickSound.play().catch(err => {
            console.log('播放点击音效失败:', err);
          });
          appState.soundState.isClickSoundPlaying = true;
          
          setTimeout(() => {
            appState.soundState.isClickSoundPlaying = false;
          }, 500);
        } catch (error) {
          console.error('音效播放错误:', error);
          appState.soundState.isClickSoundPlaying = false;
        }
      }
      
      updatePngOverlayOnClick();
      
      appState.clickCount++;
      document.getElementById('start-tip').innerHTML = 
        `点击老鼠<br>还需 ${3 - appState.clickCount} 次`;

      mouseClickJump();

      if (appState.clickCount >= 3) {
        switchToScene('main');
      }
    } else {
      console.log(`未点击到老鼠，距离: ${distanceToMouse.toFixed(2)}`);
    }
    return;
  }
}

// 点击老鼠时更新PNG叠加层图片（带渐隐渐显效果）
function updatePngOverlayOnClick() {
  if (!appState.pngOverlay || !appState.pngOverlay.material) return;
  
  let imageIndex;
  switch(appState.clickCount) {
    case 0:
      imageIndex = 1; // 第一次点击后显示小猫3
      break;
    case 1:
    case 2:
      imageIndex = 2; // 第二次及以后点击显示小猫5
      break;
    default:
      imageIndex = 2;
  }
  
  imageIndex = Math.min(Math.max(0, imageIndex), appState.catImageSequence.length - 1);
  
  // 1. 开始渐隐动画
  const fadeOutDuration = 200; // 渐隐持续时间（毫秒）
  const startTime = Date.now();
  const originalOpacity = appState.pngOverlay.material.opacity !== undefined ? 
                          appState.pngOverlay.material.opacity : 1;
  
  // 确保材质支持透明度
  appState.pngOverlay.material.transparent = true;
  
  function fadeOut() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / fadeOutDuration, 1);
    appState.pngOverlay.material.opacity = originalOpacity * (1 - progress);
    
    if (progress < 1) {
      requestAnimationFrame(fadeOut);
    } else {
      // 2. 加载新图片
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(appState.catImageSequence[imageIndex], 
        (texture) => {
          texture.alphaTest = 0.5;
          appState.pngOverlay.material.map = texture;
          appState.pngOverlay.material.needsUpdate = true;
          
          // 3. 开始渐显动画
          const fadeInDuration = 200; // 渐显持续时间（毫秒）
          const fadeInStartTime = Date.now();
          
          function fadeIn() {
            const fadeInElapsed = Date.now() - fadeInStartTime;
            const fadeInProgress = Math.min(fadeInElapsed / fadeInDuration, 1);
            appState.pngOverlay.material.opacity = originalOpacity * fadeInProgress;
            
            if (fadeInProgress < 1) {
              requestAnimationFrame(fadeIn);
            } else {
              console.log(`PNG图片已更新为: ${appState.catImageSequence[imageIndex]}`);
            }
          }
          
          fadeIn(); // 开始渐显
        },
        undefined,
        (error) => {
          console.error(`加载PNG图片失败: ${error}`);
          // 加载失败时恢复透明度
          appState.pngOverlay.material.opacity = originalOpacity;
        }
      );
    }
  }
  
  fadeOut(); // 开始渐隐
}

// 老鼠点击跳跃动画
function mouseClickJump() {
  if (!appState.mouseModel) {
    console.log('老鼠模型未加载，无法执行跳跃');
    return;
  }

  const mouse = appState.mouseModel;
  const originalY = mouse.position.y;
  const originalZ = mouse.position.z;
  const jumpHeight = 2.0;
  const swingAmount = 0.3;
  const duration = 380;
  const startTime = Date.now();

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const jumpProgress = 4 * progress * (1 - progress);
    const swingProgress = Math.sin(progress * Math.PI * 2.5);
    
    mouse.position.y = originalY + jumpHeight * jumpProgress;
    mouse.position.z = originalZ + swingAmount * swingProgress;
    
    const shakeProgress = Math.sin(progress * Math.PI * 8) * 0.15;
    mouse.position.y += shakeProgress;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      mouse.position.y = originalY;
      mouse.position.z = originalZ;
      console.log('跳跃动画完成');
    }
  }

  animate();
  console.log('触发老鼠跳跃动画');
}

// 场景切换通用函数
function switchToScene(sceneName) {
  appState.isTransitioning = true;
  
  let currentScene;
  if (appState.currentView === 'prologue') currentScene = prologueScene;
  else if (appState.currentView === 'start') currentScene = startScene;
  else if (appState.currentView === 'main') currentScene = mainScene;

  const startTip = document.getElementById('start-tip');
  
  let opacity = 1;
  const transitionSpeed = 0.02;

  function transition() {
    opacity -= transitionSpeed;
    
    if (currentScene && currentScene !== mainScene) {
      currentScene.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.opacity = opacity;
          child.material.transparent = true;
        }
      });
    }

    if (startTip && appState.currentView === 'start') {
      startTip.style.opacity = opacity;
    }

    if (opacity > 0) {
      requestAnimationFrame(transition);
    } else {
      if (currentScene) currentScene.visible = false;
      
      appState.currentView = sceneName;
      if (sceneName === 'start') {
        startScene.visible = true;
        if (startTip) {
          startTip.style.opacity = 1;
        }
      } else if (sceneName === 'main') {
        mainScene.visible = true;
        mainControls.enabled = true;
        appState.mainInstructions.style.display = 'block';
        
        if (startTip) {
          startTip.remove();
        }
      }
      
      appState.isTransitioning = false;
    }
  }

  transition();
}

// 渲染循环
function animate() {
  requestAnimationFrame(animate);

  if (appState.currentView === 'main' && appState.mainUpdate) {
    appState.mainUpdate();
  }

  if (appState.currentView === 'prologue' && !appState.isTransitioning) {
    renderer.render(prologueScene, prologueCamera);
  } else if (appState.currentView === 'start' && !appState.isTransitioning) {
    renderer.render(startScene, camera);
  } else {
    renderer.render(mainScene, camera);
  }
}
