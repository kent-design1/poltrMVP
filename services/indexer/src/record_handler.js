import { CID } from "multiformats/cid";
import "dotenv/config";
import {
  pool,
  upsertBallotDb,
  markDeleted,
  upsertLikeDb,
  markLikeDeleted,
  upsertArgumentDb,
  markArgumentDeleted,
  upsertCommentDb,
  markCommentDeleted,
  upsertReviewInvitationDb,
  markReviewInvitationDeleted,
  upsertReviewResponseDb,
  markReviewResponseDeleted,
} from "./db.js";

const GOVERNANCE_DID = process.env.PDS_GOVERNANCE_ACCOUNT_DID || "";

const COLLECTION_BALLOT = "app.ch.poltr.ballot.entry";
const COLLECTION_ARGUMENT = "app.ch.poltr.ballot.argument";
const COLLECTION_RATING = "app.ch.poltr.content.rating";
const COLLECTION_COMMENT = "app.ch.poltr.comment";
const COLLECTION_REVIEW_INVITATION = "app.ch.poltr.review.invitation";
const COLLECTION_REVIEW_RESPONSE = "app.ch.poltr.review.response";

export const handleEvent = async (evt) => {
  const collection = evt.collection;

  if (collection) {
    console.log("Handling event for collection:", collection);
  }
  if (
    collection !== COLLECTION_BALLOT &&
    collection !== COLLECTION_ARGUMENT &&
    collection !== COLLECTION_RATING &&
    collection !== COLLECTION_COMMENT &&
    collection !== COLLECTION_REVIEW_INVITATION &&
    collection !== COLLECTION_REVIEW_RESPONSE
  )
    return;

  const cidString = CID.asCID(evt.cid)?.toString();
  const did = evt.did;
  const uri = evt.uri.toString();
  const rkey = evt.rkey;
  const action = evt.event;

  if (collection === COLLECTION_BALLOT) {
    if (GOVERNANCE_DID && did !== GOVERNANCE_DID) {
      console.log(`Ignoring ballots from non-governance repo: ${did}`);
      return;
    }
    if (action === "delete") {
      await markDeleted(uri);
      return;
    }
    if (action === "create" || action === "update") {
      const record = evt.record;
      if (!record) return;
      await upsertBallotDb(pool, { uri, cid: cidString, did, rkey, record });
    }
  }

  if (collection === COLLECTION_ARGUMENT) {
    if (GOVERNANCE_DID && did !== GOVERNANCE_DID) {
      console.log(`Ignoring argument from non-governance repo: ${did}`);
      return;
    }
    if (action === "delete") {
      await markArgumentDeleted(uri);
      return;
    }
    if (action === "create" || action === "update") {
      const record = evt.record;
      if (!record) return;
      await upsertArgumentDb(pool, { uri, cid: cidString, did, rkey, record });
    }
  }

  if (collection === COLLECTION_COMMENT) {
    if (action === "delete") {
      await markCommentDeleted(uri);
      return;
    }
    if (action === "create" || action === "update") {
      const record = evt.record;
      if (!record) return;
      await upsertCommentDb(pool, { uri, cid: cidString, did, rkey, record });
    }
  }

  if (collection === COLLECTION_RATING) {
    if (action === "delete") {
      await markLikeDeleted(uri);
      return;
    }
    if (action === "create" || action === "update") {
      const record = evt.record;
      if (!record) return;
      await upsertLikeDb(pool, { uri, cid: cidString, did, rkey, record });
    }
  }

  if (collection === COLLECTION_REVIEW_INVITATION) {
    if (GOVERNANCE_DID && did !== GOVERNANCE_DID) {
      console.log(
        `Ignoring review invitation from non-governance repo: ${did}`,
      );
      return;
    }
    if (action === "delete") {
      await markReviewInvitationDeleted(uri);
      return;
    }
    if (action === "create" || action === "update") {
      const record = evt.record;
      if (!record) return;
      await upsertReviewInvitationDb(pool, { uri, cid: cidString, record });
    }
  }

  if (collection === COLLECTION_REVIEW_RESPONSE) {
    if (action === "delete") {
      await markReviewResponseDeleted(uri);
      return;
    }
    if (action === "create" || action === "update") {
      const record = evt.record;
      if (!record) return;
      await upsertReviewResponseDb(pool, {
        uri,
        cid: cidString,
        did,
        rkey,
        record,
      });
    }
  }
};
