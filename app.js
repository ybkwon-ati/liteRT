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
        this.micLevelInterval = null;
        this.micLevel = 0;
        
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
        
        // AI 모델 초기화
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

    // AI 이벤트 핸들러 설정
    setupAIHandlers() {
        const translateBtn = document.getElementById('translateBtn');
        const summarizeBtn = document.getElementById('summarizeBtn');
        const closeAiResult = document.getElementById('closeAiResult');

        translateBtn.addEventListener('click', () => this.translateText());
        summarizeBtn.addEventListener('click', () => this.summarizeText());
        closeAiResult.addEventListener('click', () => this.closeAIResult());
    }

    // AI 모델 초기화 (WebLLM)
    async initAIModel() {
        try {
            // WebLLM이 로드되었는지 확인
            if (typeof webllm === 'undefined' && typeof WebLLM === 'undefined') {
                console.warn('WebLLM이 로드되지 않았습니다. AI 기능을 사용할 수 없습니다.');
                return;
            }
            
            this.updateModel({
                status: 'AI 모델 로딩 중...',
                statusClass: 'waiting'
            });
            
            this.isModelLoading = true;
            
            // WebLLM 엔진 초기화
            const WebLLMEngine = webllm || WebLLM;
            
            // 모델 생성 (경량 모델 사용)
            this.llmEngine = await WebLLMEngine.create({
                model: "TinyLlama-1.1B-Chat-v0.4", // 경량 모델
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
            
            this.isModelReady = true;
            this.isModelLoading = false;
            
            this.updateModel({
                status: 'AI 모델 준비 완료',
                statusClass: 'waiting'
            });
            
            console.log('AI 모델 로딩 완료');
        } catch (error) {
            console.error('AI 모델 초기화 오류:', error);
            this.isModelLoading = false;
            this.isModelReady = false;
            this.updateModel({
                status: 'AI 모델 로딩 실패 (기본 모드로 실행)',
                statusClass: 'waiting'
            });
        }
    }

    // 마이크 레벨 모니터링 시작
    async startMicLevelMonitoring() {
        try {
            // AudioContext 생성
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // 마이크 스트림 가져오기
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // AnalyserNode 생성
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            
            // 마이크 입력을 Analyser에 연결
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            // 마이크 레벨 업데이트 시작
            this.updateMicLevel();
            
        } catch (error) {
            console.error('마이크 레벨 모니터링 시작 오류:', error);
        }
    }

    // 마이크 레벨 업데이트
    updateMicLevel() {
        if (!this.analyser) return;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        
        // 평균 레벨 계산
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // 0-100 범위로 정규화
        this.micLevel = Math.min(100, Math.round((average / 255) * 100));
        
        // UI 업데이트
        const micLevelFill = document.getElementById('micLevel');
        const micLevelText = document.getElementById('micLevelText');
        
        if (micLevelFill) {
            micLevelFill.style.width = this.micLevel + '%';
        }
        if (micLevelText) {
            micLevelText.textContent = this.micLevel + '%';
        }
        
        // 모델 업데이트
        this.updateModel({ micLevel: this.micLevel });
        
        // 다음 프레임 요청
        if (this.model.isRecording) {
            requestAnimationFrame(() => this.updateMicLevel());
        }
    }

    // 마이크 레벨 모니터링 중지
    stopMicLevelMonitoring() {
        if (this.micLevelInterval) {
            cancelAnimationFrame(this.micLevelInterval);
            this.micLevelInterval = null;
        }
        
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // UI 리셋
        const micLevelFill = document.getElementById('micLevel');
        const micLevelText = document.getElementById('micLevelText');
        
        if (micLevelFill) {
            micLevelFill.style.width = '0%';
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

