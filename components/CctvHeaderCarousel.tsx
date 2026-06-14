import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { Video, X } from 'lucide-react-native';
import type { CctvCamera } from '../types/cctv';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  cameras: CctvCamera[];
  fallback: React.ReactNode;
};

type CameraRequest = {
  mode: 'direct' | 'discovered' | 'common-endpoint';
  streamUrl: string;
  warmupUrl?: string;
};

type HeaderSlide =
  | { key: 'background'; type: 'background' }
  | { key: string; type: 'camera'; camera: CctvCamera; cameraIndex: number };

const CAMERA_REQUEST_HEADERS = {
  'ngrok-skip-browser-warning': 'true',
};

const DIRECT_MEDIA_EXTENSIONS = ['.mjpg', '.mjpeg', '.jpg', '.jpeg', '.png', '.webp', '.mp4', '.m3u8', '.cgi'];
const HEADER_SLIDE_INTERVAL_MS = 6500;
const HEADER_SLIDE_DURATION_MS = 1150;

function cameraHtml(streamUrl: string, fit: 'contain' | 'cover'): string {
  const escapedUrl = streamUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #020617;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      img {
        width: 100vw;
        height: 100vh;
        object-fit: ${fit};
        display: block;
        background: #020617;
      }
    </style>
  </head>
  <body>
    <img src="${escapedUrl}" />
  </body>
</html>`;
}

function isDirectMediaUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const lowerPath = url.pathname.toLowerCase();
    return DIRECT_MEDIA_EXTENSIONS.some((extension) => lowerPath.endsWith(extension));
  } catch {
    return true;
  }
}

function absoluteUrl(baseUrl: string, candidate: string): string | null {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

function isUsableCandidate(candidateUrl: string): boolean {
  try {
    const url = new URL(candidateUrl);
    const lowerPath = url.pathname.toLowerCase();
    if (lowerPath.endsWith('/cam_') || lowerPath.endsWith('/video.')) return false;
    return DIRECT_MEDIA_EXTENSIONS.some((extension) => lowerPath.endsWith(extension));
  } catch {
    return false;
  }
}

function extractCameraCandidates(baseUrl: string, html: string): string[] {
  const candidates = new Set<string>();
  const attrRegex = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(html))) {
    const value = match[1]?.trim();
    if (!value || value.startsWith('#') || value.startsWith('javascript:') || value.startsWith('data:')) continue;
    const resolved = absoluteUrl(baseUrl, value);
    if (resolved && isUsableCandidate(resolved)) candidates.add(resolved);
  }
  const stringRegex = /["']([^"']*(?:mjpg|mjpeg|jpg|jpeg|png|webp|mp4|m3u8|cgi)(?:\?[^"']*)?)["']/gi;
  while ((match = stringRegex.exec(html))) {
    const resolved = absoluteUrl(baseUrl, match[1]);
    if (resolved && isUsableCandidate(resolved)) candidates.add(resolved);
  }
  const currentCameraRegex = /currentCamera\d*\s*=\s*(\d+)/gi;
  while ((match = currentCameraRegex.exec(html))) {
    const cameraNumber = match[1];
    const cgi = absoluteUrl(baseUrl, `cam_${cameraNumber}.cgi`);
    const jpg = absoluteUrl(baseUrl, `cam_${cameraNumber}.jpg`);
    if (cgi) candidates.add(cgi);
    if (jpg) candidates.add(jpg);
  }
  const sourceOptionRegex = /<option\b[^>]*value=["']?(\d+)["']?[^>]*>/gi;
  while ((match = sourceOptionRegex.exec(html))) {
    const cameraNumber = match[1];
    const cgi = absoluteUrl(baseUrl, `cam_${cameraNumber}.cgi`);
    if (cgi) candidates.add(cgi);
  }
  return Array.from(candidates);
}

function scoreCandidate(candidateUrl: string): number {
  const lower = candidateUrl.toLowerCase();
  let score = 0;
  if (lower.includes('loading') || lower.includes('offline') || lower.includes('error') || lower.includes('logo')) score -= 100;
  if (lower.includes('favicon') || lower.includes('/css') || lower.includes('/js') || lower.includes('bg.')) score -= 80;
  if (lower.endsWith('.cgi') || lower.includes('.cgi?')) score += 80;
  if (lower.includes('mjpg') || lower.includes('mjpeg')) score += 75;
  if (lower.includes('stream') || lower.includes('video') || lower.includes('live') || lower.includes('cam_')) score += 45;
  if (lower.endsWith('.jpg') || lower.includes('.jpg?')) score += 20;
  return score;
}

function pickBestCandidate(candidates: string[]): string | null {
  const ranked = candidates
    .map((url) => ({ url, score: scoreCandidate(url) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.url ?? null;
}

function commonEndpointCandidates(rawUrl: string): CameraRequest[] {
  try {
    const url = new URL(rawUrl);
    const separator = url.pathname.endsWith('/') ? '' : '/';
    const baseUrl = `${url.origin}${url.pathname}${separator}`;
    const id = Math.random().toString();
    return [
      { mode: 'common-endpoint', streamUrl: `${baseUrl}cam_1.cgi` },
      { mode: 'common-endpoint', streamUrl: `${baseUrl}video.mjpg?q=30&fps=33&id=${id}&r=${Date.now()}`, warmupUrl: `${baseUrl}get?id=${id}&r=${Math.random()}` },
      { mode: 'common-endpoint', streamUrl: `${baseUrl}video.mjpeg` },
      { mode: 'common-endpoint', streamUrl: `${baseUrl}mjpg/video.mjpg` },
      { mode: 'common-endpoint', streamUrl: `${baseUrl}stream.mjpg` },
      { mode: 'common-endpoint', streamUrl: `${baseUrl}snapshot.jpg` },
    ];
  } catch {
    return [{ mode: 'direct', streamUrl: rawUrl }];
  }
}

function CameraWebView({ camera, interactive = true, fit = 'contain' }: { camera: CctvCamera; interactive?: boolean; fit?: 'contain' | 'cover' }) {
  const [request, setRequest] = useState<CameraRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (isDirectMediaUrl(camera.streamUrl)) {
      const directRequest: CameraRequest = { mode: 'direct', streamUrl: camera.streamUrl };
      console.log('[CCTV] prepare direct camera request', {
        cameraId: camera.id,
        name: camera.name,
        configuredUrl: camera.streamUrl,
        mode: directRequest.mode,
        streamUrl: directRequest.streamUrl,
      });
      setRequest(directRequest);
      return () => {
        cancelled = true;
      };
    }

    console.log('[CCTV] probing camera page for stream candidates', {
      cameraId: camera.id,
      name: camera.name,
      configuredUrl: camera.streamUrl,
    });
    setRequest(null);

    fetch(camera.streamUrl, { headers: CAMERA_REQUEST_HEADERS })
      .then(async (response) => {
        const text = await response.text().catch(() => '');
        if (cancelled) return;
        const candidates = extractCameraCandidates(camera.streamUrl, text);
        const bestCandidate = pickBestCandidate(candidates);
        const commonCandidates = commonEndpointCandidates(camera.streamUrl);
        const detectedRequest: CameraRequest = bestCandidate
          ? { mode: 'discovered', streamUrl: bestCandidate }
          : commonCandidates[0];
        console.log('[CCTV] camera page probe response', {
          cameraId: camera.id,
          status: response.status,
          ok: response.ok,
          candidateCount: candidates.length,
          candidates: candidates.slice(0, 8),
          selectedMode: detectedRequest.mode,
          streamUrl: detectedRequest.streamUrl,
          sample: text.slice(0, 120),
        });
        if (!detectedRequest.warmupUrl) {
          setRequest(detectedRequest);
          return;
        }
        fetch(detectedRequest.warmupUrl, { headers: CAMERA_REQUEST_HEADERS })
          .then(async (warmupResponse) => {
            const warmupText = await warmupResponse.text().catch(() => '');
            console.log('[CCTV] yawcam warmup response', {
              cameraId: camera.id,
              status: warmupResponse.status,
              ok: warmupResponse.ok,
              text: warmupText,
              warmupUrl: detectedRequest.warmupUrl,
            });
            if (!cancelled) setRequest(detectedRequest);
          })
          .catch((error: unknown) => {
            console.warn('[CCTV] yawcam warmup failed; trying stream anyway', {
              cameraId: camera.id,
              error: error instanceof Error ? error.message : String(error),
              warmupUrl: detectedRequest.warmupUrl,
            });
            if (!cancelled) setRequest(detectedRequest);
          });
      })
      .catch((error: unknown) => {
        const fallbackRequest = commonEndpointCandidates(camera.streamUrl)[0];
        console.warn('[CCTV] camera page probe failed; trying common endpoint fallback', {
          cameraId: camera.id,
          error: error instanceof Error ? error.message : String(error),
          configuredUrl: camera.streamUrl,
          fallbackUrl: fallbackRequest.streamUrl,
        });
        if (!cancelled) setRequest(fallbackRequest);
      });

    return () => {
      cancelled = true;
    };
  }, [camera.id, camera.name, camera.streamUrl]);

  console.log('[CCTV] render webview', {
    cameraId: camera.id,
    name: camera.name,
    configuredUrl: camera.streamUrl,
    directUrl: request?.streamUrl,
    mode: request?.mode,
    fit,
    interactive,
  });

  if (!request) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Connecting CCTV...</Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ html: cameraHtml(request.streamUrl, fit), baseUrl: request.streamUrl }}
      pointerEvents={interactive ? 'auto' : 'none'}
      style={{ flex: 1, backgroundColor: '#020617' }}
      originWhitelist={['http://*', 'https://*']}
      allowsFullscreenVideo
      javaScriptEnabled={false}
      domStorageEnabled={false}
      mediaPlaybackRequiresUserAction={false}
      scrollEnabled={false}
      bounces={false}
      scalesPageToFit={false}
      setSupportMultipleWindows={false}
      onLoadStart={(event) => {
        console.log('[CCTV] webview load start', {
          cameraId: camera.id,
          url: event.nativeEvent.url,
          directUrl: request.streamUrl,
          interactive,
        });
      }}
      onLoadEnd={(event) => {
        console.log('[CCTV] webview load end', {
          cameraId: camera.id,
          url: event.nativeEvent.url,
          directUrl: request.streamUrl,
          title: event.nativeEvent.title,
          loading: event.nativeEvent.loading,
        });
      }}
      onError={(event) => {
        console.warn('[CCTV] webview load error', {
          cameraId: camera.id,
          code: event.nativeEvent.code,
          description: event.nativeEvent.description,
          url: event.nativeEvent.url,
          directUrl: request.streamUrl,
        });
      }}
      onHttpError={(event) => {
        console.warn('[CCTV] webview HTTP error', {
          cameraId: camera.id,
          statusCode: event.nativeEvent.statusCode,
          description: event.nativeEvent.description,
          url: event.nativeEvent.url,
          directUrl: request.streamUrl,
        });
      }}
      onMessage={(event) => {
        console.log('[CCTV] webview message', {
          cameraId: camera.id,
          message: event.nativeEvent.data,
        });
      }}
    />
  );
}

export function CctvHeaderCarousel({ cameras, fallback }: Props) {
  const { width, height } = useWindowDimensions();
  const slides = useMemo<HeaderSlide[]>(
    () => [{ key: 'background', type: 'background' }, ...cameras.map((camera, index) => ({ key: camera.id, type: 'camera' as const, camera, cameraIndex: index }))],
    [cameras],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const lastTapRef = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const activeSlide = slides[activeIndex] ?? slides[0];
  const previousSlide = previousIndex === null ? null : slides[previousIndex] ?? null;
  const activeCamera = activeSlide?.type === 'camera' ? activeSlide.camera : null;
  const hasCameras = cameras.length > 0;

  useEffect(() => {
    console.log('[CCTV] carousel cameras changed', {
      count: cameras.length,
      cameras: cameras.map((camera) => ({ id: camera.id, name: camera.name, url: camera.streamUrl })),
    });
  }, [cameras]);

  useEffect(() => {
    if (activeIndex >= slides.length) {
      console.log('[CCTV] active slide reset because slide count changed', {
        activeIndex,
        count: slides.length,
      });
      goToSlide(0, false);
    }
  }, [activeIndex, slides.length]);

  const goToSlide = (nextIndex: number, animated = true) => {
    if (nextIndex === activeIndex || nextIndex < 0 || nextIndex >= slides.length) return;
    console.log('[CCTV] carousel slide change requested', {
      from: activeIndex,
      to: nextIndex,
      animated,
      fromKey: slides[activeIndex]?.key,
      toKey: slides[nextIndex]?.key,
    });
    if (!animated) {
      setPreviousIndex(null);
      setActiveIndex(nextIndex);
      slideAnim.setValue(0);
      return;
    }
    setPreviousIndex(activeIndex);
    setActiveIndex(nextIndex);
    slideAnim.setValue(width);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: HEADER_SLIDE_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPreviousIndex(null);
    });
  };

  useEffect(() => {
    if (slides.length < 2 || fullscreen) return;
    const timer = setInterval(() => {
      const next = (activeIndex + 1) % slides.length;
      console.log('[CCTV] carousel auto-advance', { from: activeIndex, to: next });
      goToSlide(next, true);
    }, HEADER_SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activeIndex, fullscreen, slides.length, width]);

  useEffect(() => {
    console.log('[CCTV] active slide changed', {
      activeIndex,
      cameraId: activeCamera?.id,
      name: activeCamera?.name,
      url: activeCamera?.streamUrl,
      slideType: activeSlide?.type,
    });
  }, [activeCamera, activeIndex, activeSlide]);

  useEffect(() => {
    console.log('[CCTV] fullscreen state changed', {
      fullscreen,
      cameraId: activeCamera?.id,
      name: activeCamera?.name,
    });
  }, [activeCamera, fullscreen]);

  const thumbnailCameras = useMemo(() => cameras.slice(0, 12), [cameras]);

  const handleHeaderPressIn = () => {
    if (!activeCamera) {
      console.log('[CCTV] header tap ignored because active slide is not a camera', {
        activeIndex,
        slideType: activeSlide?.type,
      });
      return;
    }
    const now = Date.now();
    const delta = now - lastTapRef.current;
    console.log('[CCTV] header tap', {
      cameraId: activeCamera?.id,
      name: activeCamera?.name,
      deltaMs: delta,
    });
    if (delta < 450) {
      console.log('[CCTV] double tap detected, opening fullscreen', {
        cameraId: activeCamera?.id,
        name: activeCamera?.name,
      });
      setFullscreen(true);
    }
    lastTapRef.current = now;
  };

  const renderHeaderSlide = (slide: HeaderSlide | null, enableTap: boolean) => {
    if (!slide) return null;
    if (slide.type === 'background') {
      return <View style={{ flex: 1 }}>{fallback}</View>;
    }
    return (
      <>
        <CameraWebView camera={slide.camera} interactive={false} fit="contain" />
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15, 23, 42, 0.18)' }} />
        <View style={{ position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.xl, gap: 6 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(15, 23, 42, 0.62)',
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Video size={14} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '900' }}>CCTV</Text>
          </View>
          <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900' }}>
            {slide.camera.name}
          </Text>
          {slide.camera.location ? (
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' }}>
              {slide.camera.location}
            </Text>
          ) : null}
        </View>
        {enableTap ? (
          <Pressable
            onPressIn={handleHeaderPressIn}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Open ${slide.camera.name} CCTV viewer`}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, elevation: 20 }}
          />
        ) : null}
      </>
    );
  };

  return (
    <>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        {previousSlide ? (
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              transform: [
                {
                  translateX: slideAnim.interpolate({
                    inputRange: [0, width],
                    outputRange: [-width, 0],
                  }),
                },
              ],
            }}
          >
            {renderHeaderSlide(previousSlide, false)}
          </Animated.View>
        ) : null}
        <Animated.View
          style={{
            flex: 1,
            transform: [{ translateX: previousSlide ? slideAnim : 0 }],
          }}
        >
          {renderHeaderSlide(activeSlide, true)}
        </Animated.View>
        {slides.length > 1 ? (
          <View style={{ position: 'absolute', right: spacing.md, bottom: spacing.xl, flexDirection: 'row', gap: 5 }}>
            {slides.map((item, index) => (
              <View
                key={item.key}
                style={{
                  width: index === activeIndex ? 18 : 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: index === activeIndex ? '#FFFFFF' : 'rgba(255, 255, 255, 0.58)',
                }}
              />
            ))}
          </View>
        ) : null}
      </View>

      <Modal visible={fullscreen} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setFullscreen(false)}>
        <View style={{ flex: 1, backgroundColor: '#020617' }}>
          {activeCamera ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 86, paddingBottom: thumbnailCameras.length > 1 ? 96 : 20 }}>
              <View
                style={{
                  width,
                  height: Math.min(width * 0.75, Math.max(120, height - (thumbnailCameras.length > 1 ? 196 : 120))),
                  backgroundColor: '#020617',
                }}
              >
                <CameraWebView camera={activeCamera} />
              </View>
            </View>
          ) : null}

          <View
            style={{
              position: 'absolute',
              top: spacing.lg,
              left: spacing.md,
              right: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900' }}>
                {activeCamera?.name ?? 'CCTV'}
              </Text>
              {activeCamera?.location ? (
                <Text numberOfLines={1} style={{ marginTop: 3, color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: '700' }}>
                  {activeCamera.location}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => {
                console.log('[CCTV] closing fullscreen viewer', {
                  cameraId: activeCamera?.id,
                  name: activeCamera?.name,
                });
                setFullscreen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close CCTV viewer"
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.16)',
              }}
            >
              <X size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          {thumbnailCameras.length > 1 ? (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: spacing.lg }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}
              >
                {thumbnailCameras.map((camera, index) => (
                  <Pressable
                    key={camera.id}
                    onPress={() => {
                      const nextSlideIndex = index + 1;
                      console.log('[CCTV] fullscreen thumbnail selected', {
                        from: activeIndex,
                        to: nextSlideIndex,
                        cameraId: camera.id,
                        name: camera.name,
                      });
                      goToSlide(nextSlideIndex, true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Switch to ${camera.name}`}
                    style={{
                      width: 74,
                      height: 54,
                      overflow: 'hidden',
                      borderRadius: radius.md,
                      borderWidth: 2,
                      borderColor: activeCamera?.id === camera.id ? '#FFFFFF' : 'rgba(255,255,255,0.24)',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4 }}>
                      <Video size={18} color={activeCamera?.id === camera.id ? '#FFFFFF' : 'rgba(255,255,255,0.72)'} />
                      <Text numberOfLines={1} style={{ marginTop: 3, color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>
                        {camera.name}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
