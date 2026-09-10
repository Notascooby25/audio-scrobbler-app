export default function FollowButton({ isFollowing, onToggle, disabled }) {
  return (
    <button type="button" className="follow-button" onClick={onToggle} disabled={disabled}>
      {isFollowing ? 'Unfollow' : 'Follow'}
    </button>
  )
}
