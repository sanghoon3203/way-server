// Way3 Admin 공통 JavaScript

// 전역 Admin 객체
window.Admin = {
    // 설정
    config: {
        apiBaseUrl: '/admin/api',
        refreshInterval: 30000, // 30초
        toastDuration: 5000 // 5초
    },

    // 유틸리티 함수들
    utils: {
        /**
         * API 요청 래퍼
         */
        async apiRequest(url, options = {}) {
            try {
                const defaultOptions = {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                };

                const response = await fetch(url, {
                    ...defaultOptions,
                    ...options,
                    headers: {
                        ...defaultOptions.headers,
                        ...options.headers
                    }
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || `HTTP Error: ${response.status}`);
                }

                return data;
            } catch (error) {
                console.error('API Request failed:', error);
                throw error;
            }
        },

        /**
         * 시간 포맷팅
         */
        formatTime(timestamp) {
            return new Date(timestamp).toLocaleString('ko-KR');
        },

        /**
         * 상대 시간 계산
         */
        timeAgo(timestamp) {
            const now = new Date();
            const past = new Date(timestamp);
            const diffMs = now - past;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return '방금 전';
            if (diffMins < 60) return `${diffMins}분 전`;
            if (diffHours < 24) return `${diffHours}시간 전`;
            return `${diffDays}일 전`;
        },

        /**
         * 파일 크기 포맷팅
         */
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';

            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));

            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        /**
         * 숫자 포맷팅 (천단위 콤마)
         */
        formatNumber(num) {
            return num.toLocaleString('ko-KR');
        },

        /**
         * 퍼센트 계산
         */
        calculatePercent(value, total) {
            if (total === 0) return 0;
            return Math.round((value / total) * 100);
        },

        /**
         * 색상 랜덤 생성
         */
        getRandomColor() {
            const colors = [
                '#0d6efd', '#6610f2', '#6f42c1', '#d63384',
                '#dc3545', '#fd7e14', '#ffc107', '#198754',
                '#20c997', '#0dcaf0'
            ];
            return colors[Math.floor(Math.random() * colors.length)];
        },

        /**
         * 로딩 스피너 표시
         */
        showLoading(element) {
            const loadingHtml = `
                <div class="d-flex justify-content-center align-items-center p-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <span class="ms-2">데이터를 불러오는 중...</span>
                </div>
            `;
            element.innerHTML = loadingHtml;
        },

        /**
         * 에러 메시지 표시
         */
        showError(element, message = '데이터를 불러올 수 없습니다.') {
            const errorHtml = `
                <div class="alert alert-danger d-flex align-items-center" role="alert">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    <div>${message}</div>
                </div>
            `;
            element.innerHTML = errorHtml;
        },

        /**
         * 빈 상태 표시
         */
        showEmpty(element, message = '데이터가 없습니다.', icon = 'bi-inbox') {
            const emptyHtml = `
                <div class="empty-state">
                    <i class="bi ${icon}"></i>
                    <div>${message}</div>
                </div>
            `;
            element.innerHTML = emptyHtml;
        }
    },

    // 알림 시스템
    notifications: {
        /**
         * Toast 알림 표시
         */
        show(message, type = 'info', duration = 5000) {
            const toastContainer = document.querySelector('.toast-container');
            if (!toastContainer) return;

            const toastId = 'toast-' + Date.now();
            const icons = {
                success: 'bi-check-circle',
                error: 'bi-exclamation-triangle',
                warning: 'bi-exclamation-triangle',
                info: 'bi-info-circle'
            };

            const colors = {
                success: 'text-success',
                error: 'text-danger',
                warning: 'text-warning',
                info: 'text-info'
            };

            const toastHtml = `
                <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="toast-header">
                        <i class="bi ${icons[type]} ${colors[type]} me-2"></i>
                        <strong class="me-auto">알림</strong>
                        <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                    </div>
                    <div class="toast-body">${message}</div>
                </div>
            `;

            toastContainer.insertAdjacentHTML('beforeend', toastHtml);

            const toastElement = document.getElementById(toastId);
            const toast = new bootstrap.Toast(toastElement, {
                autohide: true,
                delay: duration
            });

            toast.show();

            // Toast가 숨겨진 후 DOM에서 제거
            toastElement.addEventListener('hidden.bs.toast', () => {
                toastElement.remove();
            });
        },

        success(message) {
            this.show(message, 'success');
        },

        error(message) {
            this.show(message, 'error');
        },

        warning(message) {
            this.show(message, 'warning');
        },

        info(message) {
            this.show(message, 'info');
        }
    },

    // 모달 관리
    modals: {
        /**
         * 확인 모달 표시
         */
        confirm(message, title = '확인', onConfirm = () => {}) {
            const modalId = 'confirmModal-' + Date.now();
            const modalHtml = `
                <div class="modal fade" id="${modalId}" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${title}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p>${message}</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">취소</button>
                                <button type="button" class="btn btn-primary" id="confirmBtn">확인</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

            const modalElement = document.getElementById(modalId);
            const modal = new bootstrap.Modal(modalElement);

            // 확인 버튼 이벤트
            document.getElementById('confirmBtn').addEventListener('click', () => {
                modal.hide();
                onConfirm();
            });

            // 모달이 완전히 숨겨진 후 DOM에서 제거
            modalElement.addEventListener('hidden.bs.modal', () => {
                modalElement.remove();
            });

            modal.show();
        },

        /**
         * 로딩 모달 표시
         */
        showLoading(message = '처리 중...') {
            const modalId = 'loadingModal';

            // 기존 로딩 모달이 있으면 제거
            const existingModal = document.getElementById(modalId);
            if (existingModal) {
                existingModal.remove();
            }

            const modalHtml = `
                <div class="modal fade" id="${modalId}" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-body text-center p-4">
                                <div class="spinner-border text-primary mb-3" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="mb-0">${message}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

            const modalElement = document.getElementById(modalId);
            const modal = new bootstrap.Modal(modalElement);
            modal.show();

            return modal;
        },

        /**
         * 로딩 모달 숨기기
         */
        hideLoading() {
            const modalElement = document.getElementById('loadingModal');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) {
                    modal.hide();
                    modalElement.addEventListener('hidden.bs.modal', () => {
                        modalElement.remove();
                    });
                }
            }
        }
    },

    // 데이터 관리
    data: {
        cache: new Map(),

        /**
         * 캐시된 데이터 가져오기
         */
        get(key) {
            const cached = this.cache.get(key);
            if (cached && cached.expiry > Date.now()) {
                return cached.data;
            }
            this.cache.delete(key);
            return null;
        },

        /**
         * 데이터 캐시하기
         */
        set(key, data, ttl = 300000) { // 5분 기본 TTL
            this.cache.set(key, {
                data,
                expiry: Date.now() + ttl
            });
        },

        /**
         * 캐시 무효화
         */
        invalidate(pattern) {
            if (pattern) {
                for (const key of this.cache.keys()) {
                    if (key.includes(pattern)) {
                        this.cache.delete(key);
                    }
                }
            } else {
                this.cache.clear();
            }
        }
    },

    // 초기화
    init() {
        // 공통 이벤트 리스너 등록
        this.bindEvents();

        // 전역 에러 핸들러
        this.setupErrorHandlers();

        console.log('Way3 Admin initialized');
    },

    /**
     * 공통 이벤트 바인딩
     */
    bindEvents() {
        // 모든 확인 대화상자 자동 처리
        document.addEventListener('click', (e) => {
            const confirmBtn = e.target.closest('[data-confirm]');
            if (confirmBtn) {
                e.preventDefault();
                const message = confirmBtn.dataset.confirm;
                const action = () => {
                    if (confirmBtn.href) {
                        window.location.href = confirmBtn.href;
                    } else if (confirmBtn.onclick) {
                        confirmBtn.onclick();
                    } else if (confirmBtn.form) {
                        confirmBtn.form.submit();
                    }
                };
                this.modals.confirm(message, '확인', action);
            }
        });

        // 자동 새로고침 버튼
        document.addEventListener('click', (e) => {
            const refreshBtn = e.target.closest('[data-refresh]');
            if (refreshBtn) {
                e.preventDefault();
                const target = refreshBtn.dataset.refresh;
                this.refreshContent(target);
            }
        });

        // 외부 링크 새 탭에서 열기
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="http"]');
            if (link && !link.target) {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            }
        });
    },

    /**
     * 에러 핸들러 설정
     */
    setupErrorHandlers() {
        // AJAX 에러 처리
        document.addEventListener('ajaxError', (e) => {
            console.error('AJAX Error:', e.detail);
            this.notifications.error('서버와의 통신 중 오류가 발생했습니다.');
        });

        // 전역 에러 처리
        window.addEventListener('error', (e) => {
            console.error('Global Error:', e.error);
            if (process.env.NODE_ENV === 'development') {
                this.notifications.error(`JavaScript 오류: ${e.message}`);
            }
        });

        // Promise 에러 처리
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled Promise Rejection:', e.reason);
            if (process.env.NODE_ENV === 'development') {
                this.notifications.error(`Promise 에러: ${e.reason}`);
            }
        });
    },

    /**
     * 콘텐츠 새로고침
     */
    async refreshContent(target) {
        const element = document.querySelector(target);
        if (!element) return;

        try {
            this.utils.showLoading(element);

            // 실제 새로고침 로직은 각 페이지에서 구현
            const event = new CustomEvent('contentRefresh', {
                detail: { target, element }
            });
            document.dispatchEvent(event);

        } catch (error) {
            console.error('Content refresh failed:', error);
            this.utils.showError(element, '새로고침 중 오류가 발생했습니다.');
        }
    }
};

// DOM 로드 완료 후 Admin 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.Admin.init();
});

// 전역 함수로 노출 (기존 코드 호환성)
window.showToast = (message, type) => {
    window.Admin.notifications.show(message, type);
};