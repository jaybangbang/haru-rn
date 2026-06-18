import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  ScrollView, Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PurchasesPackage } from 'react-native-purchases';
import { PAL } from '@/constants/palette';
import { Toast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { getOfferings, purchasePackage, restorePurchases } from '@/lib/purchases';
import { migrateAnonymousData } from '@/lib/auth';

const { width } = Dimensions.get('window');

const FEATURES = [
  { icon: '☁️', label: '클라우드 백업' },
  { icon: '💻', label: 'PC 웹 작성' },
  { icon: '🔒', label: '안전한 보관' },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { oldId } = useLocalSearchParams<{ oldId?: string }>();

  const [offerings, setOfferings] = useState<{ monthly?: PurchasesPackage; yearly?: PurchasesPackage } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  const [loading, setLoading] = useState(false);
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  useEffect(() => {
    getOfferings()
      .then(offering => {
        if (!offering) return;
        const monthly = offering.availablePackages.find(p => p.product.identifier.includes('monthly'));
        const yearly = offering.availablePackages.find(p => p.product.identifier.includes('yearly'));
        setOfferings({ monthly, yearly });
      })
      .catch(() => {
        // RevenueCat 미설정 시 하드코딩 가격 표시
      })
      .finally(() => setLoadingOfferings(false));
  }, []);

  const onSuccess = async () => {
    if (oldId) await migrateAnonymousData(oldId);
    router.replace('/(tabs)');
  };

  const handlePurchase = async () => {
    const pkg = selectedPlan === 'yearly' ? offerings?.yearly : offerings?.monthly;

    if (!pkg) {
      // RevenueCat 미설정 상태 (개발 중): 결제 없이 진행
      if (__DEV__) {
        Toast.show('DEV: 결제 스킵 (RevenueCat 미설정)');
        await onSuccess();
        return;
      }
      Toast.show('잠시 후 다시 시도해주세요');
      return;
    }

    try {
      setLoading(true);
      const success = await purchasePackage(pkg);
      if (success) {
        await onSuccess();
      } else {
        Toast.show('결제가 취소되었어요');
      }
    } catch (e: any) {
      if (!e.userCancelled) Toast.show('결제 중 오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      const hasActive = await restorePurchases();
      if (hasActive) {
        await onSuccess();
      } else {
        Toast.show('활성 구독을 찾을 수 없어요');
      }
    } catch {
      Toast.show('복원 중 오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    // 결제 없이 닫기 — Supabase 계정은 생성됐으므로 다시 익명으로
    if (oldId) await supabase.auth.signOut();
    router.replace('/(tabs)');
    Toast.show('구독 시 클라우드 백업이 활성화돼요');
  };

  const monthlyPrice = offerings?.monthly?.product.priceString ?? '₩6,900';
  const yearlyPrice = offerings?.yearly?.product.priceString ?? '₩69,000';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={12}>
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>일기를 안전하게{'\n'}보관해요</Text>
        <Text style={styles.sub}>
          계정을 만들면 클라우드로 일기를 안전하게 백업할 수 있어요.{'\n'}PC 웹으로도 작성할 수 있어요.
        </Text>

        <View style={styles.featureRow}>
          {FEATURES.map(f => (
            <View key={f.label} style={styles.featurePill}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* 요금 카드 */}
        <View style={styles.planCards}>
          {/* 연간 */}
          <Pressable
            style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('yearly')}
          >
            <View style={styles.planCardTop}>
              <View>
                <Text style={[styles.planLabel, selectedPlan === 'yearly' && styles.planLabelSelected]}>연간 구독</Text>
                <Text style={[styles.planSub, selectedPlan === 'yearly' && styles.planSubSelected]}>월 5,750원</Text>
              </View>
              <View style={styles.planRight}>
                <View style={styles.bestValueBadge}>
                  <Text style={styles.bestValueText}>2개월 무료</Text>
                </View>
                <Text style={[styles.planPrice, selectedPlan === 'yearly' && styles.planPriceSelected]}>
                  {loadingOfferings ? '...' : yearlyPrice}
                </Text>
              </View>
            </View>
          </Pressable>

          {/* 월간 */}
          <Pressable
            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('monthly')}
          >
            <View style={styles.planCardTop}>
              <Text style={[styles.planLabel, selectedPlan === 'monthly' && styles.planLabelSelected]}>월간 구독</Text>
              <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceSelected]}>
                {loadingOfferings ? '...' : `${monthlyPrice}/월`}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* 하단 고정 */}
      <View style={styles.bottom}>
        <Pressable style={styles.ctaBtn} onPress={handlePurchase}>
          <Text style={styles.ctaBtnText}>구독하고 시작하기</Text>
        </Pressable>
        <Pressable style={styles.restoreBtn} onPress={handleRestore}>
          <Text style={styles.restoreBtnText}>이미 구독했어요 (구매 복원)</Text>
        </Pressable>
        <Text style={styles.legal}>
          구독은 iTunes 계정으로 청구됩니다. 구독은 갱신일 24시간 전까지 취소할 수 있어요.
        </Text>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={PAL.bg} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAL.indigoDeep,
  },
  closeBtn: {
    position: 'absolute',
    top: 0, right: 20,
    zIndex: 10,
    padding: 12,
  },
  closeBtnText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
  },
  scroll: {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headline: {
    fontSize: 30,
    fontWeight: '500',
    color: PAL.bg,
    fontFamily: 'NotoSerifKR-Medium',
    lineHeight: 46,
    marginBottom: 14,
  },
  sub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 36,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  featureIcon: { fontSize: 14 },
  featureLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  planCards: {
    gap: 12,
  },
  planCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    padding: 18,
  },
  planCardSelected: {
    borderColor: PAL.amberSoft,
    backgroundColor: 'rgba(245,220,182,0.1)',
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
  },
  planLabelSelected: {
    color: PAL.amberSoft,
  },
  planSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 3,
  },
  planSubSelected: {
    color: 'rgba(245,220,182,0.6)',
  },
  planRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  bestValueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: PAL.amberDeep,
    borderRadius: 999,
  },
  bestValueText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
  },
  planPriceSelected: {
    color: PAL.amberSoft,
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 8,
    gap: 12,
  },
  ctaBtn: {
    backgroundColor: PAL.bg,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: PAL.indigoDeep,
    letterSpacing: -0.3,
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreBtnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  legal: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    lineHeight: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
