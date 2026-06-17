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
    role: '친구',
    description: '성장욕구 강하고 활기 넘치는 친구. 억지 응원 없이 자연스럽게 기운 줌',
    color: '#1B173F',
    image: require('../assets/persona_siwon.png'),
  },
  wit: {
    key: 'wit',
    name: '한하경',
    role: '친구',
    description: '항상 내 편. 공감 잘해주고 나의 인간적인 면모를 알아봐주는 친구',
    color: '#D9914A',
    image: require('../assets/persona_hakyung.jpg'),
  },
  coach: {
    key: 'coach',
    name: '유채아',
    role: '멘토',
    description: '직업 고민 있을 때만 나타남. 조언은 존댓말로',
    color: '#7A8A66',
    image: require('../assets/persona_chaea.jpg'),
  },
};

export const PERSONA_LIST = Object.values(PERSONAS);
