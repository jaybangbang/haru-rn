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
    description: 'MBTI T. 분석하려다 가끔 이상한 말 함. 근데 유머는 있음',
    color: '#1B173F',
    image: require('../assets/persona_siwon.png'),
  },
  wit: {
    key: 'wit',
    name: '한하경',
    role: '친구',
    description: 'MBTI F. 공감 잘해줌. 이대로도 괜찮다고 말해주는 친구',
    color: '#D9914A',
    image: require('../assets/persona_hakyung.jpg'),
  },
  coach: {
    key: 'coach',
    name: '박서진',
    role: '멘토',
    description: '직업 고민 있을 때만 나타남. 조언은 존댓말로',
    color: '#7A8A66',
    image: require('../assets/persona_seojin_placeholder.png'),
  },
};

export const PERSONA_LIST = Object.values(PERSONAS);
