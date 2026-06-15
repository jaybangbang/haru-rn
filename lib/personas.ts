import { PersonaKey } from './types';
import { ImageSourcePropType } from 'react-native';

export interface Persona {
  key: PersonaKey;
  name: string;
  role: string;
  description: string;
  color: string;
  image: ImageSourcePropType;
}

export const PERSONAS: Record<PersonaKey, Persona> = {
  insighter: {
    key: 'insighter',
    name: '김시원',
    role: '인사이터',
    description: '전직 애널리스트, 숫자보다 맥락을 읽는 남자',
    color: '#1B173F',
    image: require('../assets/persona_siwon.png'),
  },
  wit: {
    key: 'wit',
    name: '한하경',
    role: '공감러',
    description: '스타트업 3년차, 매일 아티클 30개 읽는 여자',
    color: '#D9914A',
    image: require('../assets/persona_hakyung.jpg'),
  },
  coach: {
    key: 'coach',
    name: '박서진',
    role: '코치',
    description: '전직 라이프코치, 오늘의 감정을 내일의 행동으로 바꿔주는 사람',
    color: '#7A8A66',
    image: require('../assets/persona_seojin_placeholder.png'),
  },
};

export const PERSONA_LIST = Object.values(PERSONAS);
