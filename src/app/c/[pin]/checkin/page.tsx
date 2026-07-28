import { CheckinExperience } from '@/components/kid/CheckinExperience'

export default function CheckinPage({ params }: { params: Promise<{ pin: string }> }) {
  return <CheckinExperience />
}
