// LiteRT.js를 이용한 실시간 전사 애플리케이션

class TranscriptionApp {
    constructor() {
        this.recognition = null;
        this.permissionCheckInterval = null;
        this.isPageVisible = true;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        // 마이크 레벨 모니터링
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.micStream = null;
        this.micLevelInterval = null;
        this.micLevel = 0;
        this.isMicLevelMonitoring = false;
        
        // AI 모델 (WebLLM)
        this.llmEngine = null;
        this.isModelLoading = false;
        this.isModelReady = false;
        
        // LiteRT.js 반응형 데이터 모델
        this.model = {
            isRecording: false,
            transcriptionText: '',
            currentTranscript: '',
            history: [],
            status: '대기 중...',
            statusClass: 'waiting',
            language: '언어: 한국어',
            micPermission: 'prompt', // 'granted', 'denied', 'prompt'
            micLevel: 0
        };
        
        this.init();
    }

    init() {
        // Web Speech API 지원 확인
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome, Edge, Safari 최신 버전을 사용해주세요.');
            return;
        }

        // Speech Recognition 초기화
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // 설정
        this.recognition.lang = 'ko-KR'; // 한국어
        this.recognition.continuous = true; // 연속 인식
        this.recognition.interimResults = true; // 중간 결과 표시
        
        // LiteRT.js 반응형 시스템 초기화
        this.initReactiveSystem();
        
        // 이벤트 핸들러 설정
        this.setupEventHandlers();
        this.setupRecognitionHandlers();
        
        // 페이지 가시성 및 권한 모니터링 설정
        this.setupVisibilityHandlers();
        this.setupPermissionMonitoring();
        
        // 모델 설정 UI 이벤트 핸들러 설정
        this.setupModelConfigHandlers();
        
        // 저장된 모델 설정 불러오기
        this.loadSavedModelConfig();
        
        // AI 모델 초기화 (저장된 모델이 있으면 사용)
        this.initAIModel();
        
        // AI 이벤트 핸들러 설정
        this.setupAIHandlers();
    }

    initReactiveSystem() {
        // LiteRT.js가 사용 가능한 경우 반응형 시스템 초기화
        if (typeof LiteRT !== 'undefined') {
            // LiteRT.js를 사용한 반응형 바인딩
            this.reactiveModel = LiteRT.reactive(this.model);
            
            // 데이터 변경 시 UI 자동 업데이트
            this.setupReactiveBindings();
        } else {
            // LiteRT.js가 없는 경우 폴백: 수동 업데이트
            console.warn('LiteRT.js를 찾을 수 없습니다. 기본 모드로 실행합니다.');
        }
    }

    setupReactiveBindings() {
        // 반응형 데이터 변경 감지 및 UI 업데이트
        if (this.reactiveModel) {
            // isRecording 변경 감지
            LiteRT.watch(() => this.reactiveModel.isRecording, () => {
                this.updateUI();
            });
            
            // transcriptionText 변경 감지
            LiteRT.watch(() => this.reactiveModel.transcriptionText + this.reactiveModel.currentTranscript, () => {
                this.updateTranscriptionDisplay();
            });
            
            // history 변경 감지
            LiteRT.watch(() => this.reactiveModel.history, () => {
                this.updateHistoryDisplay();
            });
            
            // status 변경 감지
            LiteRT.watch(() => this.reactiveModel.status, () => {
                this.updateStatusDisplay();
            });
        }
    }

    setupEventHandlers() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const clearBtn = document.getElementById('clearBtn');

        startBtn.addEventListener('click', () => this.startTranscription());
        stopBtn.addEventListener('click', () => this.stopTranscription());
        clearBtn.addEventListener('click', () => this.clearTranscription());
    }

    // 모델 설정 UI 이벤트 핸들러 설정
    setupModelConfigHandlers() {
        const modelConfigBtn = document.getElementById('modelConfigBtn');
        const closeModal = document.getElementById('closeModal');
        const cancelModelBtn = document.getElementById('cancelModelBtn');
        const loadModelBtn = document.getElementById('loadModelBtn');
        const tabBtns = document.querySelectorAll('.tab-btn');
        const presetBtns = document.querySelectorAll('.preset-btn');
        const customModelId = document.getElementById('customModelId');
        const searchBtn = document.getElementById('searchBtn');

        // 모델 설정 버튼 이벤트 (여러 개 있을 수 있으므로 모두 처리)
        const modelConfigBtns = document.querySelectorAll('#modelConfigBtn');
        modelConfigBtns.forEach(btn => {
            btn.addEventListener('click', () => this.openModelConfig());
        });
        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeModelConfig());
        }
        if (cancelModelBtn) {
            cancelModelBtn.addEventListener('click', () => this.closeModelConfig());
        }
        if (loadModelBtn) {
            loadModelBtn.addEventListener('click', () => this.loadSelectedModel());
        }

        // 탭 전환
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // 프리셋 모델 선택
        presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modelId = e.target.dataset.model;
                customModelId.value = modelId;
                loadModelBtn.disabled = false;
            });
        });

        // 커스텀 모델 입력
        if (customModelId) {
            customModelId.addEventListener('input', () => {
                loadModelBtn.disabled = !customModelId.value.trim();
            });
        }

        // 모달 외부 클릭 시 닫기
        const modal = document.getElementById('modelConfigModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModelConfig();
                }
            });
        }

        // 검색 버튼
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.searchModels());
        }
    }

    // AI 이벤트 핸들러 설정
    setupAIHandlers() {
        const translateBtn = document.getElementById('translateBtn');
        const summarizeBtn = document.getElementById('summarizeBtn');
        const closeAiResult = document.getElementById('closeAiResult');

        translateBtn.addEventListener('click', () => this.translateText());
        summarizeBtn.addEventListener('click', () => this.summarizeText());
        closeAiResult.addEventListener('click', () => this.closeAIResult());
    }

    // 탭 전환
    switchTab(tabName) {
        const tabs = document.querySelectorAll('.tab-content');
        const tabBtns = document.querySelectorAll('.tab-btn');

        tabs.forEach(tab => tab.classList.remove('active'));
        tabBtns.forEach(btn => btn.classList.remove('active'));

        document.getElementById(tabName + 'Tab').classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    // 모델 설정 모달 열기
    openModelConfig() {
        const modal = document.getElementById('modelConfigModal');
        if (modal) {
            modal.style.display = 'flex';
            this.loadAvailableModels();
        }
    }

    // 모델 설정 모달 닫기
    closeModelConfig() {
        const modal = document.getElementById('modelConfigModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 사용 가능한 모델 목록 로드
    async loadAvailableModels() {
        const modelList = document.getElementById('modelList');
        if (!modelList) return;

        modelList.innerHTML = '<div class="loading-models">모델 목록 로딩 중...</div>';

        try {
            // WebLLM에서 지원하는 일반적인 모델 목록
            const models = [
                { id: 'TinyLlama-1.1B-Chat-v0.4', name: 'TinyLlama 1.1B', desc: '경량 모델 (약 700MB), 빠른 응답' },
                { id: 'Llama-3.2-3B-Instruct-q4f32_1', name: 'Llama 3.2 3B', desc: '중형 모델 (약 2GB), 높은 품질' },
                { id: 'Phi-3-mini-4k-instruct-q4f32_1', name: 'Phi-3 Mini', desc: '경량 모델 (약 2GB), 효율적' },
                { id: 'Qwen2.5-0.5B-Instruct-q4f32_1', name: 'Qwen2.5 0.5B', desc: '초경량 모델 (약 300MB), 매우 빠름' },
                { id: 'Mistral-7B-Instruct-v0.2-q4f32_1', name: 'Mistral 7B', desc: '대형 모델 (약 4GB), 최고 품질' },
                { id: 'Gemma-2-2B-it-q4f32_1', name: 'Gemma 2 2B', desc: '중형 모델 (약 1.5GB), 균형잡힌 성능' }
            ];

            this.availableModels = models;
            this.renderModelList(models);

        } catch (error) {
            console.error('모델 목록 로드 오류:', error);
            modelList.innerHTML = '<div class="loading-models">모델 목록을 불러올 수 없습니다.</div>';
        }
    }

    // 모델 목록 렌더링
    renderModelList(models, searchTerm = '') {
        const modelList = document.getElementById('modelList');
        if (!modelList) return;

        const filteredModels = searchTerm 
            ? models.filter(m => 
                m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.id.toLowerCase().includes(searchTerm.toLowerCase())
              )
            : models;

        if (filteredModels.length === 0) {
            modelList.innerHTML = '<div class="loading-models">검색 결과가 없습니다.</div>';
            return;
        }

        modelList.innerHTML = filteredModels.map(model => `
            <div class="model-item" data-model-id="${model.id}">
                <div class="model-item-name">${model.name}</div>
                <div class="model-item-desc">${model.desc}</div>
                <div class="model-item-id" style="font-size: 0.8em; color: #999; margin-top: 5px;">${model.id}</div>
            </div>
        `).join('');

        // 모델 선택 이벤트
        modelList.querySelectorAll('.model-item').forEach(item => {
            item.addEventListener('click', () => {
                modelList.querySelectorAll('.model-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                const loadBtn = document.getElementById('loadModelBtn');
                if (loadBtn) {
                    loadBtn.disabled = false;
                }
            });
        });
    }

    // 모델 검색
    searchModels() {
        const searchInput = document.getElementById('modelSearch');
        const searchTerm = searchInput ? searchInput.value : '';
        this.renderModelList(this.availableModels, searchTerm);
    }

    // 선택한 모델 로드
    async loadSelectedModel() {
        const modelList = document.getElementById('modelList');
        const customModelId = document.getElementById('customModelId');
        const loadBtn = document.getElementById('loadModelBtn');
        const loadingStatus = document.getElementById('modelLoadingStatus');
        const modelProgress = document.getElementById('modelProgress');
        const modelProgressText = document.getElementById('modelProgressText');
        const modelStatusText = document.getElementById('modelStatusText');

        let selectedModelId = null;

        // 커스텀 탭에서 입력한 모델 ID 확인
        if (customModelId && customModelId.value.trim()) {
            selectedModelId = customModelId.value.trim();
        } else {
            // 갤러리 탭에서 선택한 모델 확인
            const selectedItem = modelList?.querySelector('.model-item.selected');
            if (selectedItem) {
                selectedModelId = selectedItem.dataset.modelId;
            }
        }

        if (!selectedModelId) {
            alert('모델을 선택해주세요.');
            return;
        }

        // 로딩 UI 표시
        if (loadBtn) loadBtn.disabled = true;
        if (loadingStatus) loadingStatus.style.display = 'block';
        if (modelStatusText) modelStatusText.textContent = '모델 다운로드 중...';

        try {
            // 기존 모델 정리
            if (this.llmEngine) {
                try {
                    await this.llmEngine.unload();
                } catch (e) {
                    console.warn('기존 모델 언로드 오류:', e);
                }
                this.llmEngine = null;
            }

            this.isModelReady = false;
            this.isModelLoading = true;

            // WebLLM 엔진 초기화
            const WebLLMEngine = webllm || WebLLM;
            
            this.llmEngine = await WebLLMEngine.create({
                model: selectedModelId,
                initProgressCallback: (report) => {
                    console.log('모델 로딩 진행:', report);
                    const progress = report.progress || 0;
                    
                    if (modelProgress) {
                        modelProgress.style.width = (progress * 100) + '%';
                    }
                    if (modelProgressText) {
                        modelProgressText.textContent = Math.round(progress * 100) + '%';
                    }
                    if (modelStatusText) {
                        if (report.text) {
                            modelStatusText.textContent = report.text;
                        } else {
                            modelStatusText.textContent = `모델 로딩 중... ${Math.round(progress * 100)}%`;
                        }
                    }
                }
            });

            this.currentModelId = selectedModelId;
            this.isModelReady = true;
            this.isModelLoading = false;

            // 모델 설정 저장
            this.saveModelConfig(selectedModelId);

            // UI 업데이트
            const currentModelName = document.getElementById('currentModelName');
            if (currentModelName) {
                currentModelName.textContent = selectedModelId;
            }

            this.updateModel({
                status: 'AI 모델 준비 완료',
                statusClass: 'waiting'
            });

            // 모달 닫기
            this.closeModelConfig();

            alert('모델이 성공적으로 로드되었습니다!');

        } catch (error) {
            console.error('모델 로드 오류:', error);
            this.isModelLoading = false;
            this.isModelReady = false;
            
            if (modelStatusText) {
                modelStatusText.textContent = '모델 로드 실패: ' + error.message;
            }
            
            alert('모델 로드 중 오류가 발생했습니다: ' + error.message);
        } finally {
            if (loadBtn) loadBtn.disabled = false;
        }
    }

    // 모델 설정 저장
    saveModelConfig(modelId) {
        try {
            localStorage.setItem('webllm_model_id', modelId);
        } catch (error) {
            console.error('모델 설정 저장 오류:', error);
        }
    }

    // 저장된 모델 설정 불러오기
    loadSavedModelConfig() {
        try {
            const savedModelId = localStorage.getItem('webllm_model_id');
            if (savedModelId) {
                this.currentModelId = savedModelId;
                const currentModelName = document.getElementById('currentModelName');
                if (currentModelName) {
                    currentModelName.textContent = savedModelId;
                }
            }
        } catch (error) {
            console.error('모델 설정 불러오기 오류:', error);
        }
    }

    // AI 모델 초기화 (WebLLM)
    async initAIModel() {
        try {
            // WebLLM이 로드되었는지 확인
            if (typeof webllm === 'undefined' && typeof WebLLM === 'undefined') {
                console.warn('WebLLM이 로드되지 않았습니다. AI 기능을 사용할 수 없습니다.');
                const currentModelName = document.getElementById('currentModelName');
                if (currentModelName) {
                    currentModelName.textContent = 'WebLLM 미로드';
                }
                return;
            }
            
            // 저장된 모델이 있으면 사용, 없으면 기본 모델 사용
            const modelId = this.currentModelId || "TinyLlama-1.1B-Chat-v0.4";
            
            this.updateModel({
                status: 'AI 모델 로딩 중...',
                statusClass: 'waiting'
            });
            
            this.isModelLoading = true;
            
            // WebLLM 엔진 초기화
            const WebLLMEngine = webllm || WebLLM;
            
            // 모델 생성
            this.llmEngine = await WebLLMEngine.create({
                model: modelId,
                initProgressCallback: (report) => {
                    console.log('모델 로딩 진행:', report);
                    if (report.progress) {
                        this.updateModel({
                            status: `AI 모델 로딩 중... ${Math.round(report.progress * 100)}%`,
                            statusClass: 'waiting'
                        });
                    }
                }
            });
            
            this.currentModelId = modelId;
            this.isModelReady = true;
            this.isModelLoading = false;
            
            // 모델 설정 저장
            this.saveModelConfig(modelId);
            
            // UI 업데이트
            const currentModelName = document.getElementById('currentModelName');
            if (currentModelName) {
                currentModelName.textContent = modelId;
            }
            
            this.updateModel({
                status: 'AI 모델 준비 완료',
                statusClass: 'waiting'
            });
            
            console.log('AI 모델 로딩 완료:', modelId);
        } catch (error) {
            console.error('AI 모델 초기화 오류:', error);
            this.isModelLoading = false;
            this.isModelReady = false;
            
            const currentModelName = document.getElementById('currentModelName');
            if (currentModelName) {
                currentModelName.textContent = '로드 실패';
            }
            
            this.updateModel({
                status: 'AI 모델 로딩 실패 (기본 모드로 실행)',
                statusClass: 'waiting'
            });
        }
    }

    // 마이크 레벨 모니터링 시작
    async startMicLevelMonitoring() {
        try {
            // 이미 모니터링 중이면 중복 실행 방지
            if (this.isMicLevelMonitoring) {
                return;
            }

            // AudioContext 생성 (suspended 상태일 수 있으므로 resume)
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // 마이크 스트림 가져오기
            this.micStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                } 
            });
            
            // AnalyserNode 생성
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.3;
            
            // 마이크 입력을 Analyser에 연결
            this.microphone = this.audioContext.createMediaStreamSource(this.micStream);
            this.microphone.connect(this.analyser);
            
            this.isMicLevelMonitoring = true;
            
            // 마이크 레벨 업데이트 시작
            this.updateMicLevel();
            
        } catch (error) {
            console.error('마이크 레벨 모니터링 시작 오류:', error);
            this.isMicLevelMonitoring = false;
        }
    }

    // 마이크 레벨 업데이트
    updateMicLevel() {
        if (!this.analyser || !this.isMicLevelMonitoring) {
            return;
        }
        
        // 시간 도메인 데이터 사용 (더 정확한 레벨 측정)
        const dataArray = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteTimeDomainData(dataArray);
        
        // 최대값 찾기
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const value = Math.abs(dataArray[i] - 128); // 128을 중심으로
            if (value > max) {
                max = value;
            }
        }
        
        // 0-100 범위로 정규화 (더 민감하게 조정)
        this.micLevel = Math.min(100, Math.round((max / 128) * 100));
        
        // 최소값 설정 (노이즈 필터링)
        if (this.micLevel < 2) {
            this.micLevel = 0;
        }
        
        // UI 업데이트
        const micLevelFill = document.getElementById('micLevel');
        const micLevelText = document.getElementById('micLevelText');
        
        if (micLevelFill) {
            micLevelFill.style.width = this.micLevel + '%';
            // 레벨에 따라 색상 변경
            if (this.micLevel > 70) {
                micLevelFill.style.background = 'linear-gradient(90deg, #ff6b6b 0%, #ee5a6f 100%)';
            } else if (this.micLevel > 40) {
                micLevelFill.style.background = 'linear-gradient(90deg, #feca57 0%, #ff9ff3 100%)';
            } else {
                micLevelFill.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
            }
        }
        if (micLevelText) {
            micLevelText.textContent = this.micLevel + '%';
        }
        
        // 모델 업데이트
        this.updateModel({ micLevel: this.micLevel });
        
        // 다음 프레임 요청
        if (this.model.isRecording && this.isMicLevelMonitoring) {
            requestAnimationFrame(() => this.updateMicLevel());
        }
    }

    // 마이크 레벨 모니터링 중지
    stopMicLevelMonitoring() {
        this.isMicLevelMonitoring = false;
        
        if (this.micLevelInterval) {
            cancelAnimationFrame(this.micLevelInterval);
            this.micLevelInterval = null;
        }
        
        // 스트림 트랙 중지
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => {
                track.stop();
            });
            this.micStream = null;
        }
        
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close().catch(err => {
                console.error('AudioContext 종료 오류:', err);
            });
            this.audioContext = null;
        }
        
        // UI 리셋
        const micLevelFill = document.getElementById('micLevel');
        const micLevelText = document.getElementById('micLevelText');
        
        if (micLevelFill) {
            micLevelFill.style.width = '0%';
            micLevelFill.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
        }
        if (micLevelText) {
            micLevelText.textContent = '0%';
        }
        
        this.micLevel = 0;
        this.updateModel({ micLevel: 0 });
    }

    // 텍스트 번역
    async translateText() {
        const text = this.model.transcriptionText.trim();
        
        if (!text) {
            alert('번역할 텍스트가 없습니다.');
            return;
        }

        if (!this.isModelReady || !this.llmEngine) {
            alert('AI 모델이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        const translateBtn = document.getElementById('translateBtn');
        translateBtn.disabled = true;

        try {
            this.showAIResult('번역 중...', 'AI가 텍스트를 번역하고 있습니다...');
            
            const prompt = `다음 한국어 텍스트를 영어로 번역해주세요. 번역만 출력하고 다른 설명은 하지 마세요:\n\n${text}`;
            
            // WebLLM API 사용
            const response = await this.llmEngine.chat({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_gen_len: 500
            });

            const translatedText = response.message || response.text || response;
            this.showAIResult('번역 결과', translatedText);
            
        } catch (error) {
            console.error('번역 오류:', error);
            this.showAIResult('번역 오류', '번역 중 오류가 발생했습니다: ' + error.message);
        } finally {
            translateBtn.disabled = false;
        }
    }

    // 텍스트 요약
    async summarizeText() {
        const text = this.model.transcriptionText.trim();
        
        if (!text) {
            alert('요약할 텍스트가 없습니다.');
            return;
        }

        if (!this.isModelReady || !this.llmEngine) {
            alert('AI 모델이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        const summarizeBtn = document.getElementById('summarizeBtn');
        summarizeBtn.disabled = true;

        try {
            this.showAIResult('요약 중...', 'AI가 텍스트를 요약하고 있습니다...');
            
            const prompt = `다음 텍스트를 간결하게 요약해주세요. 핵심 내용만 3-5문장으로 요약해주세요:\n\n${text}`;
            
            // WebLLM API 사용
            const response = await this.llmEngine.chat({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.5,
                max_gen_len: 300
            });

            const summarizedText = response.message || response.text || response;
            this.showAIResult('요약 결과', summarizedText);
            
        } catch (error) {
            console.error('요약 오류:', error);
            this.showAIResult('요약 오류', '요약 중 오류가 발생했습니다: ' + error.message);
        } finally {
            summarizeBtn.disabled = false;
        }
    }

    // AI 결과 표시
    showAIResult(title, content) {
        const aiResultSection = document.getElementById('aiResultSection');
        const aiResultTitle = document.getElementById('aiResultTitle');
        const aiResult = document.getElementById('aiResult');
        
        if (aiResultTitle) aiResultTitle.textContent = title;
        if (aiResult) {
            if (content.includes('...')) {
                aiResult.innerHTML = '<div class="ai-loading">' + content + '</div>';
            } else {
                aiResult.textContent = content;
            }
        }
        if (aiResultSection) aiResultSection.style.display = 'block';
    }

    // AI 결과 닫기
    closeAIResult() {
        const aiResultSection = document.getElementById('aiResultSection');
        if (aiResultSection) {
            aiResultSection.style.display = 'none';
        }
    }

    // 페이지 가시성 핸들러 설정 (탭 전환 감지)
    setupVisibilityHandlers() {
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            
            if (!this.isPageVisible && this.model.isRecording) {
                // 탭이 비활성화되면 일시 중지
                console.log('페이지가 비활성화되어 전사를 일시 중지합니다.');
            } else if (this.isPageVisible && this.model.isRecording) {
                // 탭이 다시 활성화되면 권한이 있으면 재시작 (재요청 안함)
                if (this.model.micPermission === 'granted') {
                    this.restartTranscription();
                } else {
                    // 권한이 없으면 중지
                    this.updateModel({
                        status: '마이크 권한이 필요합니다.',
                        statusClass: 'error'
                    });
                    this.stopTranscription();
                }
            }
        });
    }

    // 마이크 권한 모니터링 설정 (조용히 확인만, 재요청 안함)
    setupPermissionMonitoring() {
        // 주기적으로 권한 상태만 확인 (10초마다, 팝업 없이)
        this.permissionCheckInterval = setInterval(() => {
            if (this.model.isRecording && this.isPageVisible) {
                this.checkMicrophonePermissionSilent();
            }
        }, 10000);
    }

    // 마이크 권한 확인 (조용히, 팝업 없이)
    async checkMicrophonePermissionSilent() {
        try {
            // MediaDevices API를 사용한 권한 확인 (팝업 없이)
            if (navigator.permissions && navigator.permissions.query) {
                const result = await navigator.permissions.query({ name: 'microphone' });
                const permissionState = result.state;
                
                this.updateModel({
                    micPermission: permissionState === 'granted' ? 'granted' : 
                                  permissionState === 'denied' ? 'denied' : 'prompt'
                });
                
                // 권한이 해제되었으면 상태만 업데이트 (재요청 안함)
                if (permissionState !== 'granted' && this.model.isRecording) {
                    console.log('마이크 권한 상태 확인:', permissionState);
                    // 재요청하지 않고 상태만 업데이트
                }
                
                return permissionState === 'granted';
            }
            return false;
        } catch (error) {
            // 조용히 실패 처리
            return false;
        }
    }

    // 마이크 권한 확인 (사용자 액션 시에만 사용)
    async checkMicrophonePermission() {
        try {
            // MediaDevices API를 사용한 권한 확인
            if (navigator.permissions && navigator.permissions.query) {
                const result = await navigator.permissions.query({ name: 'microphone' });
                const permissionState = result.state;
                
                this.updateModel({
                    micPermission: permissionState === 'granted' ? 'granted' : 
                                  permissionState === 'denied' ? 'denied' : 'prompt'
                });
                
                return permissionState === 'granted';
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    // 마이크 권한 요청
    async requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // 즉시 중지
            this.updateModel({ 
                micPermission: 'granted',
                status: '마이크 권한이 허용되었습니다.',
                statusClass: 'waiting'
            });
            this.retryCount = 0;
            return true;
        } catch (error) {
            console.error('마이크 권한 요청 실패:', error);
            this.updateModel({ 
                micPermission: 'denied',
                status: '마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.',
                statusClass: 'error'
            });
            return false;
        }
    }

    // 전사 재시작 (권한 확인 후)
    restartTranscription() {
        if (!this.model.isRecording) return;
        
        try {
            if (this.recognition) {
                this.recognition.stop();
                setTimeout(() => {
                    if (this.model.isRecording && this.model.micPermission === 'granted') {
                        this.recognition.start();
                    }
                }, 500);
            }
        } catch (error) {
            console.error('전사 재시작 오류:', error);
        }
    }

    setupRecognitionHandlers() {
        // 음성 인식 시작
        this.recognition.onstart = () => {
            this.updateModel({ 
                isRecording: true,
                status: '전사 중...',
                statusClass: 'recording'
            });
        };

        // 음성 인식 결과
        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            // 최종 결과가 있으면 저장
            if (finalTranscript) {
                this.updateModel({
                    transcriptionText: this.model.transcriptionText + finalTranscript,
                    currentTranscript: ''
                });
            } else {
                this.updateModel({
                    currentTranscript: interimTranscript
                });
            }
        };

        // 음성 인식 오류
        this.recognition.onerror = (event) => {
            console.error('음성 인식 오류:', event.error);
            
            let errorMessage = '오류가 발생했습니다.';
            let shouldRetry = false;
            
            switch(event.error) {
                case 'no-speech':
                    errorMessage = '음성이 감지되지 않습니다.';
                    // 음성 없음은 재시도하지 않음
                    break;
                case 'audio-capture':
                    errorMessage = '마이크를 찾을 수 없습니다.';
                    shouldRetry = true;
                    break;
                case 'not-allowed':
                    errorMessage = '마이크 권한이 필요합니다. 전사를 중지합니다.';
                    // 자동 재요청 안함, 사용자가 버튼을 눌러야 함
                    this.updateModel({ micPermission: 'denied' });
                    this.stopTranscription();
                    return;
                case 'network':
                    errorMessage = '네트워크 오류가 발생했습니다. 재시도합니다...';
                    shouldRetry = true;
                    break;
                case 'aborted':
                    // 중단된 경우는 재시도하지 않음
                    return;
            }
            
            this.updateModel({
                status: errorMessage,
                statusClass: 'error'
            });
            
            // 재시도 가능한 오류이고 최대 재시도 횟수 내라면 재시도
            if (shouldRetry && this.model.isRecording && this.retryCount < this.maxRetries) {
                this.retryCount++;
                setTimeout(() => {
                    if (this.model.isRecording && this.model.micPermission === 'granted') {
                        try {
                            this.recognition.start();
                        } catch (error) {
                            console.error('재시도 오류:', error);
                        }
                    }
                }, 2000);
            } else if (this.retryCount >= this.maxRetries) {
                // 최대 재시도 횟수 초과 시 중지
                this.updateModel({
                    status: '오류가 지속되어 전사를 중지합니다.',
                    statusClass: 'error'
                });
                this.stopTranscription();
                this.retryCount = 0;
            }
        };

        // 음성 인식 종료
        this.recognition.onend = () => {
            if (this.model.isRecording && this.isPageVisible) {
                // 권한이 허용되어 있으면 자동으로 다시 시작 (연속 전사)
                // 권한 재요청은 하지 않음
                if (this.model.micPermission === 'granted') {
                    try {
                        this.recognition.start();
                        this.retryCount = 0; // 성공 시 재시도 카운터 리셋
                    } catch (error) {
                        console.error('자동 재시작 오류:', error);
                        // 권한 오류면 중지 (재요청 안함)
                        if (error.message.includes('not allowed') || error.message.includes('permission')) {
                            this.updateModel({
                                status: '마이크 권한이 필요합니다.',
                                statusClass: 'error',
                                micPermission: 'denied'
                            });
                            this.stopTranscription();
                        }
                    }
                } else {
                    // 권한이 없으면 중지 (재요청 안함)
                    this.updateModel({
                        status: '마이크 권한이 필요합니다.',
                        statusClass: 'error'
                    });
                    this.stopTranscription();
                }
            } else if (!this.model.isRecording) {
                this.updateModel({
                    status: '대기 중...',
                    statusClass: 'waiting'
                });
            }
        };
    }

    // 모델 업데이트 헬퍼 함수 (LiteRT.js 반응형 지원)
    updateModel(updates) {
        Object.assign(this.model, updates);
        
        // LiteRT.js 반응형 모델이 있으면 업데이트
        if (this.reactiveModel) {
            Object.assign(this.reactiveModel, updates);
        }
        
        // 수동 업데이트 (폴백)
        this.updateUI();
        this.updateTranscriptionDisplay();
        this.updateStatusDisplay();
    }

    async startTranscription() {
        if (!this.recognition) {
            alert('음성 인식을 초기화할 수 없습니다.');
            return;
        }

        // 먼저 마이크 권한 확인 및 요청
        const hasPermission = await this.checkMicrophonePermission();
        
        if (!hasPermission) {
            const granted = await this.requestMicrophonePermission();
            if (!granted) {
                this.updateModel({
                    status: '마이크 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.',
                    statusClass: 'error'
                });
                return;
            }
        }

        this.retryCount = 0; // 재시도 카운터 리셋
        
        // 마이크 레벨 모니터링 시작
        await this.startMicLevelMonitoring();
        
        try {
            this.recognition.start();
        } catch (error) {
            console.error('전사 시작 오류:', error);
            if (error.message.includes('already started')) {
                // 이미 시작된 경우 무시
                return;
            }
            
            // 권한 관련 오류면 재요청
            if (error.message.includes('not allowed') || error.message.includes('permission')) {
                await this.requestMicrophonePermission();
            } else {
                this.updateModel({
                    status: '전사를 시작할 수 없습니다: ' + error.message,
                    statusClass: 'error'
                });
            }
        }
    }

    stopTranscription() {
        this.updateModel({ isRecording: false });
        this.retryCount = 0; // 재시도 카운터 리셋
        
        // 마이크 레벨 모니터링 중지
        this.stopMicLevelMonitoring();
        
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('전사 중지 오류:', error);
            }
        }
        
        // 현재 전사 내용을 기록에 저장
        if (this.model.transcriptionText.trim()) {
            this.saveToHistory();
        }
    }

    // 정리 함수 (페이지 언로드 시 호출)
    cleanup() {
        if (this.permissionCheckInterval) {
            clearInterval(this.permissionCheckInterval);
        }
        this.stopMicLevelMonitoring();
        this.stopTranscription();
    }

    clearTranscription() {
        if (confirm('전사 내용을 모두 지우시겠습니까?')) {
            this.updateModel({
                transcriptionText: '',
                currentTranscript: ''
            });
        }
    }

    saveToHistory() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ko-KR');
        
        const historyItem = {
            time: timeString,
            text: this.model.transcriptionText.trim()
        };
        
        const newHistory = [historyItem, ...this.model.history];
        this.updateModel({
            history: newHistory,
            transcriptionText: ''
        });
    }

    updateTranscriptionDisplay() {
        const transcriptionElement = document.getElementById('transcription');
        const displayText = this.model.transcriptionText + this.model.currentTranscript;
        
        if (displayText.trim()) {
            transcriptionElement.textContent = displayText;
            transcriptionElement.classList.remove('empty');
        } else {
            transcriptionElement.textContent = '전사 결과가 여기에 표시됩니다...';
            transcriptionElement.classList.add('empty');
        }
    }

    updateHistoryDisplay() {
        const historyElement = document.getElementById('history');
        
        if (this.model.history.length === 0) {
            historyElement.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">기록이 없습니다.</p>';
            return;
        }
        
        historyElement.innerHTML = this.model.history.map(item => `
            <div class="history-item">
                <div class="history-item-time">${item.time}</div>
                <div class="history-item-text">${item.text}</div>
            </div>
        `).join('');
    }

    updateStatusDisplay() {
        const statusElement = document.getElementById('status');
        statusElement.textContent = this.model.status;
        statusElement.className = `status ${this.model.statusClass}`;
    }

    updateUI() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        
        if (this.model.isRecording) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } else {
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    }
}

// 앱 초기화
let appInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    appInstance = new TranscriptionApp();
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (appInstance) {
        appInstance.cleanup();
    }
});

