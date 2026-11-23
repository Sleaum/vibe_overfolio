from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from profiles.models import Profile

from .models import GoogleAccount


@transaction.atomic
def user_for_google(claims: dict):
    """
    Utilisateur du compte Google `claims` (jeton d'identité vérifié) : retrouvé par `sub`, sinon créé.
    Renvoie (utilisateur, créé). À la création, le profil du site est recopié une fois sur le nouveau profil.
    """
    sub = claims["sub"]
    details = {
        "email": claims.get("email", ""),
        "name": claims.get("name", "") or "",
        "picture": claims.get("picture", "") or "",
    }
    account = GoogleAccount.objects.select_related("user").select_for_update().filter(sub=sub).first()
    if account:
        for field, value in details.items():
            setattr(account, field, value)
        account.save()
        user = account.user
        if user.email != details["email"]:
            user.email = details["email"]
            user.save(update_fields=["email"])
        return user, False

    User = get_user_model()
    username = f"google-{sub}"[:150]
    # Utilisateur resté seul (compte Google supprimé dans l'admin) : il retrouve son compte Google
    orphan = User.objects.filter(username=username, google_account__isnull=True).first()
    if orphan is not None:
        GoogleAccount.objects.create(user=orphan, sub=sub, **details)
        return orphan, False

    try:
        with transaction.atomic():  # deux retours de Google en même temps : un seul crée le compte
            user = User(
                username=username,
                email=details["email"],
                first_name=(claims.get("given_name") or "")[:150],
                last_name=(claims.get("family_name") or "")[:150],
            )
            user.set_unusable_password()  # connexion par Google seulement
            user.save()
            GoogleAccount.objects.create(user=user, sub=sub, **details)
    except IntegrityError:
        account = GoogleAccount.objects.select_related("user").get(sub=sub)
        return account.user, False
    Profile.copy_site_profile(user)
    return user, True
