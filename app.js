// LiteRT.js를 이용한 실시간 전사 애플리케이션

class TranscriptionApp {
    constructor() {
        this.recognition = null;
        
        // LiteRT.js 반응형 데이터 모델
        this.model = {
            isRecording: false,
            transcriptionText: '',
            currentTranscript: '',
            history: [],
            status: '대기 중...',
            statusClass: 'waiting',
            language: '언어: 한국어'
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
            switch(event.error) {
                case 'no-speech':
                    errorMessage = '음성이 감지되지 않습니다.';
                    break;
                case 'audio-capture':
                    errorMessage = '마이크를 찾을 수 없습니다.';
                    break;
                case 'not-allowed':
                    errorMessage = '마이크 권한이 필요합니다.';
                    break;
                case 'network':
                    errorMessage = '네트워크 오류가 발생했습니다.';
                    break;
            }
            
            this.updateModel({
                status: errorMessage,
                statusClass: 'error'
            });
            
            // 오류 발생 시 자동으로 중지
            if (this.model.isRecording) {
                this.stopTranscription();
            }
        };

        // 음성 인식 종료
        this.recognition.onend = () => {
            if (this.model.isRecording) {
                // 자동으로 다시 시작 (연속 전사)
                this.recognition.start();
            } else {
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

    startTranscription() {
        if (!this.recognition) {
            alert('음성 인식을 초기화할 수 없습니다.');
            return;
        }

        try {
            this.recognition.start();
        } catch (error) {
            console.error('전사 시작 오류:', error);
            if (error.message.includes('already started')) {
                // 이미 시작된 경우 무시
                return;
            }
            alert('전사를 시작할 수 없습니다: ' + error.message);
        }
    }

    stopTranscription() {
        this.updateModel({ isRecording: false });
        
        if (this.recognition) {
            this.recognition.stop();
        }
        
        // 현재 전사 내용을 기록에 저장
        if (this.model.transcriptionText.trim()) {
            this.saveToHistory();
        }
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
document.addEventListener('DOMContentLoaded', () => {
    new TranscriptionApp();
});

