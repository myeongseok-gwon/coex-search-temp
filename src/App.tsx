import React, { useState, useEffect } from 'react';
import { AppState, User, UserFormData } from './types';
import { loadBoothData } from './utils/dataLoader';
import { userService } from './services/supabase';
import { GPSService } from './services/gpsService';
import LandingPage from './components/LandingPage';
import UserFormPage from './components/UserFormPage';
import LoadingPage from './components/LoadingPage';
import MainPage from './components/MainPage';
import BoothDetailPage from './components/BoothDetailPage';
import MapPage from './components/MapPage';
import SurveyPage from './components/SurveyPage';
import CompletePage from './components/CompletePage';
import ExitRatingModal from './components/ExitRatingModal';
import ThankYouPage from './components/ThankYouPage';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentUser: null,
    currentPage: 'landing',
    recommendations: [],
    selectedBooth: null,
    boothData: [],
    evaluation: null,
    userFormData: null
  });

  const [showExitRatingModal, setShowExitRatingModal] = useState(false);
  const [isBoothDataLoading, setIsBoothDataLoading] = useState(true);

  useEffect(() => {
    // 부스 데이터 로드
    const loadData = async () => {
      try {
        setIsBoothDataLoading(true);
        console.log('📦 부스 데이터 로드 시작...');
        const boothData = await loadBoothData();
        console.log('✅ 부스 데이터 로드 완료:', boothData.length, '개');
        
        if (boothData.length === 0) {
          console.warn('⚠️ boothData가 비어있습니다.');
        }
        
        setState(prev => ({ ...prev, boothData }));
        setIsBoothDataLoading(false);
        
        // sessionStorage에서 상태 복원 시도
        const savedState = sessionStorage.getItem('appState');
        if (savedState) {
          try {
            const parsedState = JSON.parse(savedState);
            console.log('상태 복원:', parsedState);
            console.log('boothData (로드된 것):', boothData.length, '개');
            setState(prev => ({
              ...prev,
              currentUser: parsedState.currentUser,
              currentPage: parsedState.currentPage,
              recommendations: parsedState.recommendations || [],
              selectedBooth: parsedState.selectedBooth
              // boothData는 상위에서 이미 설정되었으므로 prev를 유지
            }));
          } catch (error) {
            console.error('상태 복원 오류:', error);
            sessionStorage.removeItem('appState');
          }
        }
      } catch (error) {
        console.error('❌ 부스 데이터 로드 오류:', error);
        setIsBoothDataLoading(false);
      }
    };
    
    loadData();
  }, []);

  // 추천 로직 비활성화로 미사용
  // const dedupeRecommendations = (list: any[]) => list;

  const startGPSTracking = async (userId: string) => {
    console.log('🚀 App.tsx: startGPSTracking 호출됨', { userId });
    
    // 기존 GPS 서비스가 있으면 완전히 정리
    if (window.gpsService) {
      console.log('🛑 기존 GPS 서비스 정리 중...');
      window.gpsService.stopTracking();
      window.gpsService = null;
      console.log('✅ 기존 GPS 서비스 정리 완료');
    }
    
    try {
      console.log('🚀 App.tsx: GPS 추적 시작 시도', {
        userId: userId,
        hasGeolocation: !!navigator.geolocation,
        userAgent: navigator.userAgent
      });
      
      const gpsService = new GPSService(userId);
      window.gpsService = gpsService;
      console.log('✅ GPSService 인스턴스 생성됨', { userId: gpsService.userId });
      
      await gpsService.startTracking(
        (location) => {
          console.log('📍 App.tsx: GPS 위치 업데이트 콜백:', location);
        },
        (error) => {
          console.error('❌ App.tsx: GPS 오류 콜백:', error);
        }
      );
      console.log('✅ App.tsx: GPS 추적 시작 성공');
      
      // GPS 서비스 디버그 정보 출력
      setTimeout(() => {
        if (window.gpsService) {
          console.log('🔍 GPS 서비스 디버그 정보:', window.gpsService.getDebugInfo());
        }
      }, 2000);
      
    } catch (error) {
      console.error('❌ App.tsx: GPS 추적 시작 실패:', error);
    }
  };

  const handleUserValid = async (userId: string, userData: any) => {
    console.log('🎯 App.tsx: handleUserValid 호출됨', { userId, userData });
    console.log('🎯 받은 사용자 데이터 상세:', JSON.stringify(userData, null, 2));
    try {
      // Admin 모드 처리 (userId === '0')
      if (userId === '0') {
        const adminUser: User = {
          user_id: '0',
          initial_form_started_at: undefined,
          initial_form_submitted_at: undefined,
          skipped_at: undefined,
          additional_form_submitted_at: undefined,
          ended_at: undefined
        };
        
        setState(prev => ({
          ...prev,
          currentUser: adminUser,
          recommendations: [],
          currentPage: 'map'
        }));
        return;
      }

      if (!userData) {
        alert('사용자 정보를 찾을 수 없습니다.');
        return;
      }

      // 새로운 사용자 플로우에 따른 페이지 결정
      // 1. 새 사용자 (initial_form_started_at이 없음) -> GPS 권한 요청 후 초기 폼
      // 2. 초기 폼 미완료 (initial_form_submitted_at이 없음) -> 초기 폼
      // 3. 초기 폼 완료, 추가 폼 미완료 (ended_at 있음, skipped_at과 additional_form_submitted_at 없음) -> 추가 질문
      // 4. 완료된 사용자 (skipped_at 또는 additional_form_submitted_at 있음) -> 메인 페이지
      
      console.log('사용자 상태 확인:', {
        userId: userData.user_id,
        initial_form_started_at: userData.initial_form_started_at,
        initial_form_submitted_at: userData.initial_form_submitted_at,
        ended_at: userData.ended_at,
        skipped_at: userData.skipped_at,
        additional_form_submitted_at: userData.additional_form_submitted_at,
        has_rec_result: !!userData.rec_result
      });

      if (!userData.initial_form_started_at) {
        // 새 사용자 - GPS 권한 요청 후 초기 폼으로
        setState(prev => ({
          ...prev,
          currentUser: userData as User,
          currentPage: 'form'
        }));
        
        // GPS 추적 시작
        await startGPSTracking(userData.user_id);
        return;
      }

      if (!userData.initial_form_submitted_at) {
        // 초기 폼 미완료 - 초기 폼으로
        setState(prev => ({
          ...prev,
          currentUser: userData as User,
          currentPage: 'form'
        }));
        
        // GPS 추적 시작
        await startGPSTracking(userData.user_id);
        return;
      }


      if (userData.skipped_at || userData.additional_form_submitted_at) {
        // 완료된 사용자 - 추천 파싱 없이 바로 메인 페이지로
        setState(prev => ({
          ...prev,
          currentUser: userData as User,
          recommendations: [],
          currentPage: 'recommendations'
        }));
        console.log('⏭️ 완료된 사용자 - 바로 메인 페이지로 이동');
        return;
      }

      // 기본적으로 초기 폼으로
      setState(prev => ({
        ...prev,
        currentUser: userData as User,
        currentPage: 'form'
      }));

      // GPS 추적 시작
      await startGPSTracking(userData.user_id);

    } catch (error) {
      console.error('사용자 검증 오류:', error);
      alert('사용자 검증 중 오류가 발생했습니다.');
    }
  };

  // 추천 생성 비활성화: 더 이상 사용하지 않음

  const handleFormSubmit = async (formData: UserFormData) => {
    if (!state.currentUser) return;

    try {
      // 사용자 정보 업데이트
      await userService.updateUserFormData(state.currentUser.user_id, formData);
      await userService.updateInitialFormSubmittedAt(state.currentUser.user_id);
      
      // 폼 데이터를 상태에 저장
      setState(prev => ({
        ...prev,
        userFormData: formData
      }));
      // 로딩/추천 생성 없이 바로 메인으로 이동
      setState(prev => ({
        ...prev,
        currentPage: 'recommendations'
      }));
    } catch (error) {
      console.error('폼 제출 오류:', error);
      alert('폼 제출 중 오류가 발생했습니다. 다시 시도해주세요.');
      setState(prev => ({
        ...prev,
        currentPage: 'form'
      }));
    }
  };

  // createVisitorInfo 비활성화: 더 이상 사용하지 않음


  const handleUserUpdate = (updatedUser: User) => {
    setState(prev => ({
      ...prev,
      currentUser: updatedUser
    }));
  };


  const handleSurveyComplete = (updatedUser: User) => {
    setState(prev => ({
      ...prev,
      currentUser: updatedUser,
      currentPage: 'complete'
    }));
  };

  const handleBack = () => {
    setState(prev => {
      if (prev.currentPage === 'detail') {
        return {
          ...prev,
          selectedBooth: null,
          currentPage: 'recommendations'
        };
      } else if (prev.currentPage === 'map') {
        return {
          ...prev,
          currentPage: 'recommendations'
        };
      } else if (prev.currentPage === 'recommendations') {
        // 추천 페이지에서 뒤로가기를 누르면 폼 페이지로 이동 (정보 수정 가능)
        return {
          ...prev,
          currentPage: 'form'
        };
      } else if (prev.currentPage === 'form') {
        return {
          ...prev,
          currentUser: null,
          currentPage: 'landing'
        };
      }
      return prev;
    });
  };

  const handleExit = () => {
    console.log('🚪 App.tsx: handleExit 호출됨');
    
    // 별점 수집 모달 표시
    setShowExitRatingModal(true);
  };

  const handleExitRatingSubmit = async (exhibitionRating: number, mapHelpfulness: number) => {
    console.log('⭐ 별점 제출:', { exhibitionRating, mapHelpfulness });
    
    try {
      // 종료시점 저장 (ended_at 업데이트)
      if (state.currentUser) {
        await userService.updateUserFormData(state.currentUser.user_id, {});
        console.log('✅ 종료시점 저장 완료');
      }

      // 별점 저장
      if (state.currentUser) {
        await userService.updateExitRatings(state.currentUser.user_id, exhibitionRating, mapHelpfulness);
        console.log('✅ 별점 저장 완료');
      }
    } catch (error) {
      console.error('❌ 별점 저장 오류:', error);
    }

    // 모달 닫기
    setShowExitRatingModal(false);
    
    // GPS 추적 중지
    if (window.gpsService) {
      console.log('🛑 GPS 추적 중지 중...');
      window.gpsService.stopTracking();
      console.log('✅ GPS 추적 중지 완료');
      
      // GPS 서비스 정리
      window.gpsService = null;
    } else {
      console.log('⚠️ GPS 서비스가 없음');
    }
    
    // 감사 메시지 페이지로 이동
    console.log('🙏 감사 메시지 페이지로 이동');
    setState(prev => ({
      ...prev,
      currentPage: 'thankyou'
    }));
  };

  const handleExitRatingCancel = () => {
    console.log('❌ 별점 수집 취소');
    setShowExitRatingModal(false);
  };

  const handleThankYouComplete = () => {
    console.log('🙏 감사 메시지 완료 - 앱 초기화');
    
    // 세션 스토리지 초기화 (다음 세션에서 깨끗한 상태로 시작)
    sessionStorage.clear();
    
    // 앱 초기화 (boothData는 유지 - 캐시됨)
    setState({
      currentUser: null,
      userFormData: null,
      recommendations: [],
      boothData: state.boothData, // boothData는 유지
      currentPage: 'landing',
      selectedBooth: null,
      evaluation: null
    });
    console.log('✅ 앱 상태 초기화 완료 (boothData 유지)');
  };

  const renderCurrentPage = () => {
    switch (state.currentPage) {
      case 'landing':
        return <LandingPage onUserValid={handleUserValid} />;
      
      case 'form':
        if (!state.currentUser) return null;
        return (
          <UserFormPage
            onSubmit={handleFormSubmit}
            onBack={handleBack}
            initialData={state.userFormData}
          />
        );
      
      case 'loading':
        return <LoadingPage />;
      
      case 'recommendations':
        if (!state.currentUser) return null;
        // boothData가 로딩 중이면 로딩 페이지 표시
        if (isBoothDataLoading) {
          console.log('⏳ boothData 로딩 중...');
          return <LoadingPage />;
        }
        // boothData가 비어있으면 에러 표시
        if (state.boothData.length === 0) {
          console.error('❌ boothData가 비어있습니다.');
          return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <h2>오류 발생</h2>
              <p>부스 데이터를 불러오는데 실패했습니다.</p>
              <button onClick={() => window.location.reload()}>페이지 새로고침</button>
            </div>
          );
        }
        return (
          <MainPage
            user={state.currentUser}
            recommendations={state.recommendations}
            boothData={state.boothData}
            onBack={handleBack}
            onExit={handleExit}
          />
        );
      
      case 'map':
        if (!state.currentUser) return null;
        // boothData가 로딩 중이면 로딩 페이지 표시
        if (isBoothDataLoading) {
          return <LoadingPage />;
        }
        // boothData가 비어있으면 에러 표시
        if (state.boothData.length === 0) {
          return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <h2>오류 발생</h2>
              <p>부스 데이터를 불러오는데 실패했습니다.</p>
              <button onClick={() => window.location.reload()}>페이지 새로고침</button>
            </div>
          );
        }
        return (
          <MapPage
            user={state.currentUser}
            recommendations={state.recommendations}
            onBack={handleBack}
          />
        );
      
      case 'survey':
        if (!state.currentUser) return null;
        return (
          <SurveyPage
            user={state.currentUser}
            onComplete={handleSurveyComplete}
          />
        );
      
      case 'complete':
        return <CompletePage />;
      
      case 'thankyou':
        return <ThankYouPage onComplete={handleThankYouComplete} />;
      
      case 'detail':
        if (!state.currentUser || !state.selectedBooth) return null;
        // 추천 리스트에서 해당 부스의 rationale을 찾음
        const selectedBooth = state.selectedBooth;
        const recommendation = state.recommendations.find(
          rec => rec.id === selectedBooth.id
        );
        return (
          <BoothDetailPage
            user={state.currentUser}
            booth={selectedBooth}
            rationale={recommendation?.rationale}
            onBack={handleBack}
            onUserUpdate={handleUserUpdate}
          />
        );
      
      default:
        return <LandingPage onUserValid={handleUserValid} />;
    }
  };

  return (
    <div className="App">
      {renderCurrentPage()}
      
      {/* 별점 수집 모달 */}
      {showExitRatingModal && (
        <ExitRatingModal
          onClose={handleExitRatingCancel}
          onSubmit={handleExitRatingSubmit}
        />
      )}
    </div>
  );
};

export default App;
